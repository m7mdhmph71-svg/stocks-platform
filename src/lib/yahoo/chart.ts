// بيانات الشموع من ياهو v8/finance/chart — بدون crumb.
// عند أي فشل تعيد [] (التحليل الفني يتخطى السهم بدل إسقاط الطلب كله).

import { Candle } from "@/lib/types";
import { cached } from "@/lib/cache";
import { yahooJson } from "@/lib/yahoo/client";

/** كل الفترات المدعومة في الرسم البياني (تطابق قيم range في واجهة ياهو) */
export type ChartRange =
  | "1d"
  | "5d"
  | "1mo"
  | "3mo"
  | "6mo"
  | "ytd"
  | "1y"
  | "2y"
  | "5y"
  | "max";

/** الفاصل الأنسب لكل فترة — يوازن دقة الرسم مع عدد النقاط */
const RANGE_INTERVAL: Record<ChartRange, string> = {
  "1d": "5m",
  "5d": "30m",
  "1mo": "1d",
  "3mo": "1d",
  "6mo": "1d",
  ytd: "1d",
  "1y": "1d",
  "2y": "1d",
  "5y": "1wk",
  max: "1mo",
};

/** هل الفترة لحظية (شموع داخل الجلسة تُعرض بالساعة لا بالتاريخ)؟ */
export function isIntradayRange(range: ChartRange): boolean {
  return range === "1d" || range === "5d";
}

export function isChartRange(v: string): v is ChartRange {
  return Object.prototype.hasOwnProperty.call(RANGE_INTERVAL, v);
}

/** كاش أقصر للفترات اللحظية (تتجدد أثناء الجلسة) */
function ttlFor(range: ChartRange): number {
  return isIntradayRange(range) ? 3 * 60 * 1000 : 15 * 60 * 1000;
}

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
  const interval = RANGE_INTERVAL[range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${range}&interval=${interval}`;
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
 * شموع مرتبة تصاعدياً زمنياً بالفاصل الأنسب للفترة.
 * كاش بمفتاح candles:{ticker}:{range}. عند الفشل: [] — ولا يُخزَّن الفشل.
 */
export async function fetchCandles(
  ticker: string,
  range: ChartRange = "1y"
): Promise<Candle[]> {
  try {
    return await cached(`candles:${ticker}:${range}`, ttlFor(range), () =>
      fetchImpl(ticker, range)
    );
  } catch {
    return [];
  }
}
