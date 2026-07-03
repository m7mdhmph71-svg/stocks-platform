// بيانات الشموع اليومية من ياهو v8/finance/chart — بدون crumb.
// عند أي فشل تعيد [] (التحليل الفني يتخطى السهم بدل إسقاط الطلب كله).

import { Candle } from "@/lib/types";
import { cached } from "@/lib/cache";
import { yahooJson } from "@/lib/yahoo/client";

export type ChartRange = "1mo" | "3mo" | "6mo" | "1y" | "2y";

const TTL_MS = 15 * 60 * 1000; // كاش ١٥ دقيقة

interface ChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: Array<number | null> | null;
      indicators?: {
        quote?: Array<{
          open?: Array<number | null> | null;
          high?: Array<number | null> | null;
          low?: Array<number | null> | null;
          close?: Array<number | null> | null;
          volume?: Array<number | null> | null;
        } | null> | null;
      } | null;
    } | null> | null;
    error?: unknown;
  } | null;
}

function fin(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchImpl(ticker: string, range: ChartRange): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${range}&interval=1d`;
  const res = await yahooJson<ChartResponse>(url); // لا يحتاج crumb

  const result = res.chart?.result?.[0];
  if (!result) throw new Error(`yahoo chart: empty result for ${ticker}`);

  const times = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q) throw new Error(`yahoo chart: missing quote indicators for ${ticker}`);

  const opens = q.open ?? [];
  const highs = q.high ?? [];
  const lows = q.low ?? [];
  const closes = q.close ?? [];
  const volumes = q.volume ?? [];

  const out: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = fin(times[i]);
    const close = fin(closes[i]);
    // تجاهل الشموع الناقصة (null close)
    if (time === null || close === null) continue;

    const open = fin(opens[i]) ?? close;
    let high = fin(highs[i]) ?? Math.max(open, close);
    let low = fin(lows[i]) ?? Math.min(open, close);
    // اتساق OHLC دفاعي
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    out.push({
      time,
      open,
      high,
      low,
      close,
      volume: fin(volumes[i]) ?? 0,
    });
  }

  out.sort((a, b) => a.time - b.time);
  return out;
}

/**
 * شموع يومية مرتبة تصاعدياً زمنياً. كاش بمفتاح candles:{ticker}:{range}.
 * عند الفشل: [] — ولا يُخزَّن الفشل في الكاش.
 */
export async function fetchCandles(
  ticker: string,
  range: ChartRange = "1y"
): Promise<Candle[]> {
  try {
    return await cached(`candles:${ticker}:${range}`, TTL_MS, () =>
      fetchImpl(ticker, range)
    );
  } catch {
    return [];
  }
}
