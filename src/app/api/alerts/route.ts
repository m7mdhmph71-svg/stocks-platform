import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db, dbEnabled } from "@/lib/db";
import { cached } from "@/lib/cache";
import { batchQuotes } from "@/lib/yahoo/batchQuotes";
import { fetchFundamentals } from "@/lib/yahoo/quote";
import { screenShariah } from "@/lib/shariah/screen";
import { ScreenerResponse, StockRow } from "@/lib/types";
import {
  buildShariahChangeAlert,
  buildTradeNearStopAlert,
  buildTradeStopAlert,
  buildTradeTargetAlert,
  buildWatchlistSignalAlert,
  buildWeeklyReport,
} from "@/lib/whatsapp/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// محرك التنبيهات اللحظية — تستدعيه بوابة واتساب دورياً (كل بضع دقائق):
// يفحص الصفقات المفتوحة ضد الهدف/الوقف، وتغيّر الحكم الشرعي للمتابَعات,
// وظهور أسهم المتابعة في فلاتر اليوم، والتقرير الأسبوعي — ويعيد رسائل
// جاهزة للإرسال. جدول SentAlert يضمن ألا يتكرر التنبيه نفسه أبداً.
//
// الاستدعاء: GET /api/alerts?secret=CRON_SECRET
// الاستجابة: { ok, alerts: [{ to: "self"|رقم دولي, text }], count }

interface OutAlert {
  to: string;
  text: string;
}

interface Candidate {
  userId: string;
  to: string;
  key: string;
  text: string;
}

/** جلسة السوق الأمريكي تقريباً بالتوقيت العالمي (تغطي الصيفي والشتوي) */
function usMarketOpenUTC(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 13 * 60 + 30 && mins <= 21 * 60 + 30;
}

/** جلسة تداول السعودية: الأحد–الخميس 10:00–15:10 بتوقيت الرياض (+3) */
function saMarketOpenUTC(d: Date): boolean {
  const day = d.getUTCDay(); // الجمعة=5 والسبت=6 عطلة تداول
  if (day === 5 || day === 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 7 * 60 && mins <= 12 * 60 + 15;
}

/** جلسة سوق الرمز نفسه: تداول للسعودي (.SR) والأمريكي لسواه */
function marketOpenFor(ticker: string, d: Date): boolean {
  return ticker.toUpperCase().endsWith(".SR")
    ? saMarketOpenUTC(d)
    : usMarketOpenUTC(d);
}

const PRESET_AR: Record<string, string> = {
  momentum: "الزخم / السوينق",
  liquidity: "صيد السيولة",
};

async function fetchScreenerRows(
  origin: string,
  preset: string
): Promise<StockRow[] | null> {
  try {
    const res = await fetch(`${origin}/api/screener?preset=${preset}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ScreenerResponse;
    if (data.source === "demo") return null; // لا تنبيهات على بيانات تجريبية
    return data.rows;
  } catch {
    return null;
  }
}

/** إشارات فلاتر اليوم — تُحسب مرة واحدة يومياً وتُشارك بين كل المستخدمين */
async function todaySignals(
  origin: string,
  dateKey: string
): Promise<{ momentum: StockRow[]; liquidity: StockRow[] } | null> {
  try {
    return await cached(`alerts:signals:${dateKey}`, 12 * 60 * 60 * 1000, async () => {
      const [momentum, liquidity] = await Promise.all([
        fetchScreenerRows(origin, "momentum"),
        fetchScreenerRows(origin, "liquidity"),
      ]);
      if (momentum === null && liquidity === null) {
        // فشل كلا الفرزين — نرمي كي لا يُخزَّن الفشل 12 ساعة
        throw new Error("screener unavailable");
      }
      return { momentum: momentum ?? [], liquidity: liquidity ?? [] };
    });
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const qsSecret = request.nextUrl.searchParams.get("secret") ?? "";
  const authorized =
    secret.length > 0 && (auth === `Bearer ${secret}` || qsSecret === secret);
  if (!authorized) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }

  if (!dbEnabled()) {
    return NextResponse.json({ ok: true, alerts: [], count: 0 });
  }

  const now = new Date();
  const marketOpen = usMarketOpenUTC(now);
  const dateKey = now.toISOString().slice(0, 10);
  const candidates: Candidate[] = [];

  const users = await db().user.findMany({
    include: {
      notifyPref: true,
      trades: { where: { status: "OPEN" } },
      watchlist: true,
    },
  });

  // أسعار تذاكر الصفقات المفتوحة التي سوقها في جلسة الآن — دفعة واحدة
  const allTradeTickers = users.flatMap((u) =>
    u.notifyPref?.alertTrades === false
      ? []
      : u.trades.map((t) => t.ticker).filter((t) => marketOpenFor(t, now))
  );
  const prices =
    allTradeTickers.length > 0
      ? await batchQuotes(allTradeTickers)
      : new Map<string, { price: number | null }>();

  // إشارات فلاتر اليوم (مرة يومياً، أثناء الجلسة فقط)
  const anyWatchAlerts = users.some(
    (u) => u.watchlist.length > 0 && u.notifyPref?.alertWatchlist !== false
  );
  const signals =
    marketOpen && anyWatchAlerts
      ? await todaySignals(request.nextUrl.origin, dateKey)
      : null;

  for (const user of users) {
    const pref = user.notifyPref;
    const to = pref?.whatsappPhone || "self";

    // ١) الصفقات المفتوحة: الهدف / الاقتراب من الوقف / الوقف
    //    (كل رمز يُفحص أثناء جلسة سوقه هو: الأمريكي أو تداول)
    if (pref?.alertTrades !== false) {
      for (const t of user.trades) {
        if (!marketOpenFor(t.ticker, now)) continue;
        const price = prices.get(t.ticker)?.price ?? null;
        if (price === null) continue;
        if (price >= t.target) {
          candidates.push({
            userId: user.id,
            to,
            key: `trade:${t.id}:target`,
            text: buildTradeTargetAlert({
              ticker: t.ticker,
              entryPrice: t.entryPrice,
              target: t.target,
              price,
            }),
          });
        } else if (price <= t.stop) {
          candidates.push({
            userId: user.id,
            to,
            key: `trade:${t.id}:stop`,
            text: buildTradeStopAlert({
              ticker: t.ticker,
              entryPrice: t.entryPrice,
              stop: t.stop,
              price,
            }),
          });
        } else if (price <= t.stop * 1.02) {
          candidates.push({
            userId: user.id,
            to,
            key: `trade:${t.id}:nearstop`,
            text: buildTradeNearStopAlert({
              ticker: t.ticker,
              entryPrice: t.entryPrice,
              stop: t.stop,
              price,
            }),
          });
        }
      }
    }

    // ٢) تغيّر الحكم الشرعي لأسهم المتابعة (يعمل حتى خارج الجلسة —
    //    القوائم المالية مخبأة ٦ ساعات فالكلفة منخفضة)
    if (pref?.alertShariah !== false) {
      for (const item of user.watchlist) {
        const fund = await fetchFundamentals(item.ticker).catch(() => null);
        const sh = screenShariah(fund);
        if (sh.verdict === "UNKNOWN") continue;

        if (item.alertVerdict === null) {
          // أول رصد — نثبّت خط الأساس بصمت
          await db().watchItem.update({
            where: { id: item.id },
            data: { alertVerdict: sh.verdict },
          });
          continue;
        }
        if (item.alertVerdict !== sh.verdict) {
          const arOf = (v: string) =>
            v === "COMPLIANT"
              ? "متوافق ✅"
              : v === "MIXED"
                ? "مختلط (يجوز مع التطهير) 🟡"
                : v === "NON_COMPLIANT"
                  ? "غير متوافق ❌"
                  : v;
          candidates.push({
            userId: user.id,
            to,
            key: `shariah:${item.ticker}:${item.alertVerdict}>${sh.verdict}`,
            text: buildShariahChangeAlert(
              item.ticker,
              arOf(item.alertVerdict),
              arOf(sh.verdict)
            ),
          });
          await db().watchItem.update({
            where: { id: item.id },
            data: { alertVerdict: sh.verdict },
          });
        }
      }
    }

    // ٣) ظهور سهم من قائمة المتابعة في فلاتر اليوم
    if (signals && pref?.alertWatchlist !== false) {
      const watchSet = new Set(user.watchlist.map((w) => w.ticker));
      for (const presetKey of ["momentum", "liquidity"] as const) {
        for (const row of signals[presetKey]) {
          if (!watchSet.has(row.ticker)) continue;
          candidates.push({
            userId: user.id,
            to,
            key: `signal:${row.ticker}:${presetKey}:${dateKey}`,
            text: buildWatchlistSignalAlert(
              row.ticker,
              PRESET_AR[presetKey],
              row
            ),
          });
        }
      }
    }

    // ٤) التقرير الأسبوعي — السبت (بعد إغلاق أسبوع التداول الأمريكي)
    if (now.getUTCDay() === 6 && pref?.weeklyReport !== false) {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const closed = await db().trade.findMany({
        where: {
          userId: user.id,
          status: { not: "OPEN" },
          closedAt: { gte: weekAgo },
        },
      });
      const openCount = user.trades.length;
      if (closed.length > 0 || openCount > 0) {
        const pnls = closed
          .filter((t) => t.exitPrice !== null && t.entryPrice > 0)
          .map((t) => ({
            ticker: t.ticker,
            pnl: ((t.exitPrice! - t.entryPrice) / t.entryPrice) * 100,
          }));
        const wins = pnls.filter((p) => p.pnl > 0).length;
        const sorted = pnls.slice().sort((a, b) => b.pnl - a.pnl);
        candidates.push({
          userId: user.id,
          to,
          key: `weekly:${dateKey}`,
          text: buildWeeklyReport(
            {
              closed: closed.length,
              wins,
              losses: pnls.length - wins,
              hitRate: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
              avgReturn:
                pnls.length > 0
                  ? pnls.reduce((s, p) => s + p.pnl, 0) / pnls.length
                  : null,
              best: sorted[0] ?? null,
              worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
              open: openCount,
            },
            now
          ),
        });
      }
    }
  }

  // منع التكرار: يُرسل فقط ما نجح تسجيله لأول مرة في SentAlert
  const alerts: OutAlert[] = [];
  for (const c of candidates) {
    try {
      await db().sentAlert.create({ data: { userId: c.userId, key: c.key } });
      alerts.push({ to: c.to, text: c.text });
    } catch (e) {
      // P2002: أُرسل سابقاً — نتخطاه بصمت
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json({
    ok: true,
    alerts,
    count: alerts.length,
    asOf: now.toISOString(),
  });
}
