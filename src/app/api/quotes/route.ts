import { NextRequest, NextResponse } from "next/server";
import { yahooJson } from "@/lib/yahoo/client";
import { cached } from "@/lib/cache";
import { demoRows, isDemoTicker } from "@/lib/demo/dataset";

export const dynamic = "force-dynamic";

/** أسعار جماعية مختصرة — يستخدمها سجل نتائج الفلاتر لمقارنة «حينها/الآن» */

export interface QuoteLite {
  price: number;
  changePercent: number | null;
}

interface V7Response {
  quoteResponse?: {
    result?: Array<Record<string, unknown> | null> | null;
    error?: unknown;
  } | null;
}

const MAX_TICKERS = 60;

async function fetchQuotesLive(tickers: string[]): Promise<Record<string, QuoteLite>> {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
    encodeURIComponent(tickers.join(","));
  const res = await yahooJson<V7Response>(url, { needsCrumb: true });
  const out: Record<string, QuoteLite> = {};
  for (const q of res.quoteResponse?.result ?? []) {
    if (!q) continue;
    const symbol = typeof q.symbol === "string" ? q.symbol : null;
    const price =
      typeof q.regularMarketPrice === "number" && isFinite(q.regularMarketPrice)
        ? q.regularMarketPrice
        : null;
    if (!symbol || price === null) continue;
    out[symbol] = {
      price,
      changePercent:
        typeof q.regularMarketChangePercent === "number" &&
        isFinite(q.regularMarketChangePercent)
          ? q.regularMarketChangePercent
          : null,
    };
  }
  return out;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z0-9.\-]{1,12}$/.test(t))
    )
  ).slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "لم تُحدَّد رموز صالحة." },
      { status: 400 }
    );
  }

  const quotes: Record<string, QuoteLite> = {};

  // الرموز التجريبية: أسعارها الثابتة من مجموعة العرض
  const demo = tickers.filter(isDemoTicker);
  if (demo.length > 0) {
    const all = demoRows("all");
    for (const t of demo) {
      const r = all.find((x) => x.ticker === t);
      if (r) quotes[t] = { price: r.price, changePercent: r.changePercent };
    }
  }

  const live = tickers.filter((t) => !isDemoTicker(t));
  if (live.length > 0) {
    try {
      const key = "quotes:" + live.slice().sort().join(",");
      const fetched = await cached(key, 2 * 60_000, () => fetchQuotesLive(live));
      Object.assign(quotes, fetched);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("quotes fetch failed:", msg);
      if (Object.keys(quotes).length === 0) {
        return NextResponse.json(
          { error: "تعذّر جلب الأسعار الحالية — حاول مجدداً بعد قليل." },
          { status: 502 }
        );
      }
    }
  }

  return NextResponse.json({ quotes, asOf: new Date().toISOString() });
}
