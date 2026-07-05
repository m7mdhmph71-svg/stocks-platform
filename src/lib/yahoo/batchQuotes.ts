// أسعار لحظية لدفعة رموز عبر v7/finance/quote — مع دعم الرموز التجريبية.
// كاش دقيقتين بمفتاح مجموعة الرموز (نفس نمط مساري المتابعة والصفقات).

import { yahooJson } from "@/lib/yahoo/client";
import { cached } from "@/lib/cache";
import { demoRows, isDemoTicker } from "@/lib/demo/dataset";

export interface BatchQuote {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  name: string | null;
}

interface V7Quote {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  longName?: string;
}

export async function batchQuotes(
  tickers: string[]
): Promise<Map<string, BatchQuote>> {
  const out = new Map<string, BatchQuote>();
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));

  const demo = unique.filter(isDemoTicker);
  if (demo.length > 0) {
    const all = demoRows("all");
    for (const t of demo) {
      const r = all.find((x) => x.ticker === t);
      if (r) {
        out.set(t, {
          symbol: t,
          price: r.price,
          changePercent: r.changePercent,
          name: r.name,
        });
      }
    }
  }

  const live = unique.filter((t) => !isDemoTicker(t));
  if (live.length > 0) {
    try {
      const key = "bq:" + live.slice().sort().join(",");
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
        if (!q.symbol) continue;
        out.set(q.symbol, {
          symbol: q.symbol,
          price:
            typeof q.regularMarketPrice === "number"
              ? q.regularMarketPrice
              : null,
          changePercent:
            typeof q.regularMarketChangePercent === "number"
              ? q.regularMarketChangePercent
              : null,
          name: q.shortName ?? q.longName ?? null,
        });
      }
    } catch {
      // الأسعار غير متاحة مؤقتاً — نعيد ما تجمّع
    }
  }
  return out;
}
