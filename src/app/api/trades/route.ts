import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";
import { yahooJson } from "@/lib/yahoo/client";
import { cached } from "@/lib/cache";
import { demoRows, isDemoTicker } from "@/lib/demo/dataset";
import { limitsFor, UPGRADE_HINT_AR } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** سجل صفقاتي: فتح صفقة من إشارة، متابعتها حيّاً ضد الهدف/الوقف، وإغلاقها */

async function requireUser(): Promise<string | NextResponse> {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  return userId;
}

async function currentPrices(tickers: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const demo = tickers.filter(isDemoTicker);
  if (demo.length > 0) {
    const all = demoRows("all");
    for (const t of demo) {
      const r = all.find((x) => x.ticker === t);
      if (r) out.set(t, r.price);
    }
  }
  const live = tickers.filter((t) => !isDemoTicker(t));
  if (live.length > 0) {
    try {
      const key = "trq:" + live.slice().sort().join(",");
      const quotes = await cached(key, 2 * 60_000, async () => {
        const res = await yahooJson<{
          quoteResponse?: {
            result?: Array<{ symbol?: string; regularMarketPrice?: number } | null> | null;
          } | null;
        }>(
          "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
            encodeURIComponent(live.join(",")),
          { needsCrumb: true }
        );
        return (res.quoteResponse?.result ?? []).filter((q) => q !== null);
      });
      for (const q of quotes) {
        if (q.symbol && typeof q.regularMarketPrice === "number") {
          out.set(q.symbol, q.regularMarketPrice);
        }
      }
    } catch {
      /* أسعار غير متاحة مؤقتاً */
    }
  }
  return out;
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const trades = await db().trade.findMany({
    where: { userId: auth },
    orderBy: { openedAt: "desc" },
    take: 200,
  });

  const openTickers = Array.from(
    new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.ticker))
  );
  const prices = await currentPrices(openTickers);

  const rows = trades.map((t) => {
    const current = t.status === "OPEN" ? (prices.get(t.ticker) ?? null) : null;
    const refPrice = t.status === "OPEN" ? current : t.exitPrice;
    const pnlPercent =
      refPrice !== null && refPrice !== undefined && t.entryPrice > 0
        ? ((refPrice - t.entryPrice) / t.entryPrice) * 100
        : null;
    // تلميح حالة للصفقة المفتوحة: هل بلغ السعر الحالي الهدف/الوقف؟
    const hint =
      t.status === "OPEN" && current !== null
        ? current >= t.target
          ? "AT_TARGET"
          : current <= t.stop
            ? "AT_STOP"
            : null
        : null;
    return {
      id: t.id,
      ticker: t.ticker,
      strategy: t.strategy,
      entryPrice: t.entryPrice,
      target: t.target,
      stop: t.stop,
      qty: t.qty,
      status: t.status,
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
      exitPrice: t.exitPrice,
      notes: t.notes,
      currentPrice: current,
      pnlPercent,
      hint,
    };
  });

  return NextResponse.json({ rows, asOf: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: {
    ticker?: string;
    strategy?: string;
    entryPrice?: number;
    target?: number;
    stop?: number;
    qty?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  const entryPrice = Number(body.entryPrice);
  const target = Number(body.target);
  const stop = Number(body.stop);
  const qty = body.qty !== undefined ? Number(body.qty) : null;

  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "رمز غير صالح." }, { status: 400 });
  }
  if (!(entryPrice > 0) || !(target > entryPrice) || !(stop < entryPrice) || !(stop > 0)) {
    return NextResponse.json(
      { error: "تحقق من الأسعار: الهدف فوق الدخول والوقف تحته وكلها موجبة." },
      { status: 400 }
    );
  }
  if (qty !== null && !(qty > 0)) {
    return NextResponse.json({ error: "الكمية يجب أن تكون موجبة." }, { status: 400 });
  }

  const limits = await limitsFor(auth);
  const open = await db().trade.count({
    where: { userId: auth, status: "OPEN" },
  });
  if (open >= limits.openTradesMax) {
    return NextResponse.json(
      {
        error: `بلغت حد خطتك (${limits.openTradesMax} صفقة مفتوحة) — أغلق بعضها أو ${UPGRADE_HINT_AR}`,
      },
      { status: 403 }
    );
  }

  const trade = await db().trade.create({
    data: {
      userId: auth,
      ticker,
      strategy: (body.strategy ?? "custom").slice(0, 20),
      entryPrice,
      target,
      stop,
      qty,
      notes: (body.notes ?? "").slice(0, 500) || null,
    },
  });
  return NextResponse.json({ ok: true, id: trade.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: { id?: string; action?: string; exitPrice?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const trade = await db().trade.findFirst({
    where: { id: body.id ?? "", userId: auth },
  });
  if (!trade) {
    return NextResponse.json({ error: "الصفقة غير موجودة." }, { status: 404 });
  }
  if (trade.status !== "OPEN") {
    return NextResponse.json({ error: "الصفقة مغلقة أصلاً." }, { status: 400 });
  }

  const action = body.action ?? "";
  if (!["close", "target", "stop"].includes(action)) {
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  }

  let exitPrice = Number(body.exitPrice);
  if (!(exitPrice > 0)) {
    // بلا سعر خروج صريح: هدف → سعر الهدف، وقف → سعر الوقف، إغلاق يدوي → السعر الحالي إن توفر
    if (action === "target") exitPrice = trade.target;
    else if (action === "stop") exitPrice = trade.stop;
    else {
      const p = (await currentPrices([trade.ticker])).get(trade.ticker);
      if (!p) {
        return NextResponse.json(
          { error: "حدّد سعر الخروج (تعذّر جلب السعر الحالي)." },
          { status: 400 }
        );
      }
      exitPrice = p;
    }
  }

  await db().trade.update({
    where: { id: trade.id },
    data: {
      status: action === "target" ? "TARGET" : action === "stop" ? "STOP" : "CLOSED",
      exitPrice,
      closedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
