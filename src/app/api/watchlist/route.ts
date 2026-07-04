import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";
import { fetchFundamentals } from "@/lib/yahoo/quote";
import { screenShariah } from "@/lib/shariah/screen";
import { yahooJson } from "@/lib/yahoo/client";
import { cached } from "@/lib/cache";
import { demoRows, isDemoTicker, demoFundamentals } from "@/lib/demo/dataset";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** قائمة المتابعة: إضافة/حذف/عرض مُثرى بالسعر والحكم الشرعي وكشف تغيّره */

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

interface V7Quote {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  longName?: string;
}

async function quotesFor(tickers: string[]): Promise<Map<string, V7Quote>> {
  const out = new Map<string, V7Quote>();
  const live = tickers.filter((t) => !isDemoTicker(t));
  const demo = tickers.filter(isDemoTicker);
  if (demo.length > 0) {
    const all = demoRows("all");
    for (const t of demo) {
      const r = all.find((x) => x.ticker === t);
      if (r) {
        out.set(t, {
          symbol: t,
          regularMarketPrice: r.price,
          regularMarketChangePercent: r.changePercent ?? undefined,
          shortName: r.name,
        });
      }
    }
  }
  if (live.length > 0) {
    try {
      const key = "wlq:" + live.slice().sort().join(",");
      const quotes = await cached(key, 2 * 60_000, async () => {
        const res = await yahooJson<{
          quoteResponse?: { result?: Array<V7Quote | null> | null } | null;
        }>(
          "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
            encodeURIComponent(live.join(",")),
          { needsCrumb: true }
        );
        return (res.quoteResponse?.result ?? []).filter(
          (q): q is V7Quote => q !== null
        );
      });
      for (const q of quotes) {
        if (q.symbol) out.set(q.symbol, q);
      }
    } catch {
      // الأسعار غير متاحة مؤقتاً — نعيد القائمة بلا أسعار
    }
  }
  return out;
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const items = await db().watchItem.findMany({
    where: { userId: auth },
    orderBy: { addedAt: "desc" },
  });

  const tickers = items.map((i) => i.ticker);
  const quotes = await quotesFor(tickers);

  const rows = [];
  for (const item of items) {
    const fund = isDemoTicker(item.ticker)
      ? demoFundamentals(item.ticker)
      : await fetchFundamentals(item.ticker);
    const sh = screenShariah(fund);
    const q = quotes.get(item.ticker);

    // كشف تغيّر الحكم الشرعي منذ آخر فحص
    const verdictChanged =
      item.lastVerdict !== null &&
      sh.verdict !== "UNKNOWN" &&
      item.lastVerdict !== sh.verdict;

    if (sh.verdict !== "UNKNOWN" && sh.verdict !== item.lastVerdict) {
      await db().watchItem.update({
        where: { id: item.id },
        data: { lastVerdict: sh.verdict, lastChecked: new Date() },
      });
    }

    rows.push({
      ticker: item.ticker,
      name: q?.shortName ?? q?.longName ?? item.ticker,
      addedAt: item.addedAt.toISOString(),
      price: q?.regularMarketPrice ?? null,
      changePercent: q?.regularMarketChangePercent ?? null,
      shariah: sh,
      verdictChanged,
      previousVerdict: verdictChanged ? item.lastVerdict : null,
    });
  }

  return NextResponse.json({ rows, asOf: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: { ticker?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "رمز غير صالح." }, { status: 400 });
  }

  const count = await db().watchItem.count({ where: { userId: auth } });
  if (count >= 50) {
    return NextResponse.json(
      { error: "بلغت الحد الأقصى (50 سهماً في القائمة)." },
      { status: 400 }
    );
  }

  await db().watchItem.upsert({
    where: { userId_ticker: { userId: auth, ticker } },
    create: { userId: auth, ticker },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "")
    .trim()
    .toUpperCase();
  await db().watchItem.deleteMany({ where: { userId: auth, ticker } });
  return NextResponse.json({ ok: true });
}
