import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { batchQuotes } from "@/lib/yahoo/batchQuotes";
import { fetchCandles } from "@/lib/yahoo/chart";
import { fetchFundamentals } from "@/lib/yahoo/quote";
import { computeTechnicals } from "@/lib/targets/technicals";
import { computeTargets } from "@/lib/targets/engine";
import { screenShariah } from "@/lib/shariah/screen";
import { StockRow, TargetsResult } from "@/lib/types";
import {
  buildHelpReply,
  buildStockReply,
  buildTradesReply,
  buildWatchlistReply,
} from "@/lib/whatsapp/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// الأوامر التفاعلية عبر واتساب — تستدعيه البوابة عند وصول رسالة واردة:
// رمز سهم → تحليل فوري، «صفقاتي» → الصفقات المفتوحة، «قائمتي» → المتابعة،
// «ملخص» → إشارات اليوم، وأي شيء آخر → المساعدة.
//
// POST { from: "9665xxxxxxxx", text: "AAPL" } مع سر CRON_SECRET.

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** يطابق المرسل بحسابه: برقم واتساب المحفوظ، وإلا فالمستخدم الوحيد إن وُجد */
async function matchUser(from: string): Promise<string | null> {
  if (!dbEnabled()) return null;
  const phone = digitsOnly(from);
  if (phone.length >= 8) {
    const prefs = await db().notifyPref.findMany({
      where: { whatsappPhone: { not: null } },
      select: { userId: true, whatsappPhone: true },
    });
    const hit = prefs.find(
      (p) => digitsOnly(p.whatsappPhone ?? "") === phone
    );
    if (hit) return hit.userId;
  }
  // منصة بمالك واحد: إن كان هناك حساب واحد فهو صاحب البوابة
  const count = await db().user.count();
  if (count === 1) {
    const only = await db().user.findFirst({ select: { id: true } });
    return only?.id ?? null;
  }
  return null;
}

function firstTargetOf(t: TargetsResult): {
  target: number | null;
  stop: number | null;
  rr: number | null;
} {
  return {
    target: t.targets[0]?.price ?? null,
    stop: t.stopLoss,
    rr: t.riskReward,
  };
}

async function stockReply(ticker: string): Promise<string> {
  const [candles, fund] = await Promise.all([
    fetchCandles(ticker, "1y"),
    fetchFundamentals(ticker).catch(() => null),
  ]);
  const quote = (await batchQuotes([ticker])).get(ticker);
  const price = quote?.price ?? candles[candles.length - 1]?.close ?? null;

  if (price === null || candles.length === 0) {
    return `تعذّر العثور على بيانات للرمز ${ticker} — تأكد من صحته وحاول مجدداً.`;
  }

  const tech = computeTechnicals(candles);
  const shariah = screenShariah(fund);
  const momentum = computeTargets(
    "momentum",
    price,
    tech,
    fund?.targetMeanPrice ?? null
  );
  const liquidity = computeTargets(
    "liquidity",
    price,
    tech,
    fund?.targetMeanPrice ?? null
  );

  const row: StockRow = {
    ticker,
    name: quote?.name ?? ticker,
    exchange: null,
    sector: fund?.sector ?? null,
    industry: fund?.industry ?? null,
    price,
    changePercent: quote?.changePercent ?? null,
    changeFromOpenPercent: null,
    volume: null,
    avgVolume3m: null,
    relativeVolume: null,
    marketCap: fund?.marketCap ?? null,
    floatShares: null,
    sharesOutstanding: null,
    fiftyTwoWeekHigh: tech.high52w,
    fiftyTwoWeekLow: tech.low52w,
    weekPerfPercent: tech.weekPerfPercent,
    shariah,
    targets: null,
  };

  // رابط عام قابل للفتح من الجوال — لا نستخدم أصل الطلب (داخل الحاوية
  // يكون 0.0.0.0). الافتراضي رابط النشر المباشر، ويُخصَّص بـ PUBLIC_SITE_URL.
  return buildStockReply({
    row,
    momentum: firstTargetOf(momentum),
    liquidity: firstTargetOf(liquidity),
    purificationRatio: shariah.purificationRatio,
    siteUrl: process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || undefined,
  });
}

async function tradesReply(userId: string | null): Promise<string> {
  if (!userId) {
    return "لم أتعرف على حسابك — احفظ رقم واتسابك في صفحة «تنبيهاتي» بالمنصة أولاً.";
  }
  const trades = await db().trade.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  const prices = await batchQuotes(trades.map((t) => t.ticker));
  return buildTradesReply(
    trades.map((t) => ({
      ticker: t.ticker,
      entryPrice: t.entryPrice,
      target: t.target,
      stop: t.stop,
      currentPrice: prices.get(t.ticker)?.price ?? null,
    }))
  );
}

async function watchlistReply(userId: string | null): Promise<string> {
  if (!userId) {
    return "لم أتعرف على حسابك — احفظ رقم واتسابك في صفحة «تنبيهاتي» بالمنصة أولاً.";
  }
  const items = await db().watchItem.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  const prices = await batchQuotes(items.map((i) => i.ticker));
  const rows = [];
  for (const item of items) {
    const fund = await fetchFundamentals(item.ticker).catch(() => null);
    const sh = screenShariah(fund);
    const q = prices.get(item.ticker);
    rows.push({
      ticker: item.ticker,
      price: q?.price ?? null,
      changePercent: q?.changePercent ?? null,
      verdictAr:
        sh.verdict === "COMPLIANT"
          ? "متوافق ✅"
          : sh.verdict === "MIXED"
            ? `تطهير ${sh.purificationRatio ?? "؟"}% 🟡`
            : sh.verdict === "NON_COMPLIANT"
              ? "غير متوافق ❌"
              : "غير معروف ⚪",
    });
  }
  return buildWatchlistReply(rows);
}

async function digestReply(origin: string): Promise<string> {
  try {
    const secret = process.env.CRON_SECRET ?? "";
    const res = await fetch(
      `${origin}/api/digest?secret=${encodeURIComponent(secret)}&dry=1`,
      { cache: "no-store", signal: AbortSignal.timeout(280_000) }
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { message?: string };
    return data.message ?? "تعذّر بناء الملخص.";
  } catch {
    return "تعذّر بناء ملخص اليوم الآن — حاول بعد قليل.";
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const authorized = secret.length > 0 && auth === `Bearer ${secret}`;
  if (!authorized) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }

  let body: { from?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const from = (body.from ?? "").trim();
  const raw = (body.text ?? "").trim();
  if (!raw) {
    return NextResponse.json({ reply: buildHelpReply() });
  }

  const origin = request.nextUrl.origin;
  const norm = raw.replace(/^سهم\s+/i, "").trim();

  // أوامر نصية
  if (/^(مساعدة|المساعدة|اوامر|أوامر|الاوامر|الأوامر|help|\?|؟)$/i.test(raw)) {
    return NextResponse.json({ reply: buildHelpReply() });
  }
  if (/^(صفقاتي|صفقات)$/i.test(raw)) {
    if (!dbEnabled()) {
      return NextResponse.json({ reply: "الحسابات غير مفعّلة على هذا النشر." });
    }
    return NextResponse.json({ reply: await tradesReply(await matchUser(from)) });
  }
  if (/^(قائمتي|متابعتي|القائمة)$/i.test(raw)) {
    if (!dbEnabled()) {
      return NextResponse.json({ reply: "الحسابات غير مفعّلة على هذا النشر." });
    }
    return NextResponse.json({
      reply: await watchlistReply(await matchUser(from)),
    });
  }
  if (/^(ملخص|الملخص|اشارات|إشارات)$/i.test(raw)) {
    return NextResponse.json({ reply: await digestReply(origin) });
  }

  // رمز سهم — الرقمي الخالص (مثل 2222) يُفسَّر كرمز تداول سعودي
  let ticker = norm.toUpperCase();
  if (/^\d{3,4}$/.test(ticker)) ticker += ".SR";
  if (/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ reply: await stockReply(ticker) });
  }

  return NextResponse.json({ reply: buildHelpReply() });
}
