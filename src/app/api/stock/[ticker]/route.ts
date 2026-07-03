import { NextRequest, NextResponse } from "next/server";
import {
  Candle,
  StockDetailResponse,
  StockRow,
  StrategyKey,
  TargetsResult,
} from "@/lib/types";
import { fetchCandles } from "@/lib/yahoo/chart";
import { fetchFundamentals } from "@/lib/yahoo/quote";
import { yahooJson } from "@/lib/yahoo/client";
import { computeTechnicals } from "@/lib/targets/technicals";
import { computeTargets } from "@/lib/targets/engine";
import { screenShariah } from "@/lib/shariah/screen";
import {
  demoCandles,
  demoFundamentals,
  demoRows,
  isDemoTicker,
} from "@/lib/demo/dataset";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

const STRATEGIES: StrategyKey[] = ["liquidity", "momentum", "longterm"];

interface ChartMeta {
  symbol: string;
  longName?: string;
  shortName?: string;
  fullExchangeName?: string;
  exchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

/** ميتا السعر الحالي من واجهة chart (لا تتطلب crumb) */
async function fetchMeta(ticker: string): Promise<ChartMeta | null> {
  return cached(`meta:${ticker}`, 2 * 60_000, async () => {
    try {
      const j = await yahooJson<{
        chart: { result: Array<{ meta: ChartMeta }> | null };
      }>(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          ticker
        )}?range=5d&interval=1d`
      );
      return j.chart.result?.[0]?.meta ?? null;
    } catch {
      return null;
    }
  });
}

function lastSessionStats(candles: Candle[]) {
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  return { last, prev };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = raw.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "رمز سهم غير صالح." }, { status: 400 });
  }

  const notesAr: string[] = [];

  try {
    // — البيانات التجريبية —
    if (isDemoTicker(ticker)) {
      const row = demoRows("all").find((r) => r.ticker === ticker);
      if (!row) {
        return NextResponse.json({ error: "سهم تجريبي غير موجود." }, { status: 404 });
      }
      const candles = demoCandles(ticker);
      const fund = demoFundamentals(ticker);
      const tech = computeTechnicals(candles);
      const shariah = screenShariah(fund);
      const targetsByStrategy = Object.fromEntries(
        STRATEGIES.map((s) => [
          s,
          computeTargets(s, row.price, tech, fund?.targetMeanPrice ?? null),
        ])
      ) as Record<StrategyKey, TargetsResult>;
      const res: StockDetailResponse = {
        source: "demo",
        asOf: new Date().toISOString(),
        row: { ...row, shariah, weekPerfPercent: tech.weekPerfPercent },
        candles,
        targetsByStrategy,
        analystTargetMean: fund?.targetMeanPrice ?? null,
        analystRecommendation: fund?.recommendationKey ?? null,
        notesAr: ["هذه بيانات تجريبية للعرض فقط — ليست أسعاراً حقيقية."],
      };
      return NextResponse.json(res);
    }

    // — البيانات الحية —
    const [candles, fund, meta] = await Promise.all([
      fetchCandles(ticker, "1y"),
      fetchFundamentals(ticker),
      fetchMeta(ticker),
    ]);

    if (candles.length === 0 && !meta) {
      return NextResponse.json(
        { error: `تعذّر العثور على بيانات للرمز ${ticker} — تأكد من صحة الرمز.` },
        { status: 404 }
      );
    }

    const stats = lastSessionStats(candles);
    const price =
      meta?.regularMarketPrice ?? stats?.last.close ?? 0;
    const prevClose =
      meta?.chartPreviousClose ??
      meta?.previousClose ??
      stats?.prev?.close ??
      null;

    const changePercent =
      prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;

    // التغير من الافتتاح: من شمعة اليوم إذا كانت آخر شمعة لليوم الحالي
    let changeFromOpenPercent: number | null = null;
    if (stats?.last && stats.last.open > 0) {
      changeFromOpenPercent =
        ((price - stats.last.open) / stats.last.open) * 100;
    }

    const volume = meta?.regularMarketVolume ?? stats?.last.volume ?? null;
    const recent = candles.slice(-63);
    const avgVolume3m =
      recent.length > 0
        ? recent.reduce((s, c) => s + c.volume, 0) / recent.length
        : null;

    const tech = computeTechnicals(candles);
    const shariah = screenShariah(fund);

    const row: StockRow = {
      ticker,
      name: meta?.longName ?? meta?.shortName ?? ticker,
      exchange: meta?.fullExchangeName ?? meta?.exchangeName ?? null,
      sector: fund?.sector ?? null,
      industry: fund?.industry ?? null,
      price,
      changePercent,
      changeFromOpenPercent,
      volume,
      avgVolume3m,
      relativeVolume:
        volume !== null && avgVolume3m !== null && avgVolume3m > 0
          ? volume / avgVolume3m
          : null,
      marketCap: fund?.marketCap ?? null,
      floatShares: fund?.floatShares ?? null,
      sharesOutstanding: fund?.sharesOutstanding ?? null,
      fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh ?? tech.high52w,
      fiftyTwoWeekLow: meta?.fiftyTwoWeekLow ?? tech.low52w,
      weekPerfPercent: tech.weekPerfPercent,
      shariah,
      targets: null,
    };

    if (price <= 0) {
      return NextResponse.json(
        { error: `بيانات سعرية غير كافية للرمز ${ticker}.` },
        { status: 502 }
      );
    }

    const targetsByStrategy = Object.fromEntries(
      STRATEGIES.map((s) => [
        s,
        computeTargets(s, price, tech, fund?.targetMeanPrice ?? null),
      ])
    ) as Record<StrategyKey, TargetsResult>;

    if (!fund) {
      notesAr.push(
        "تعذّر جلب القوائم المالية — الفحص الشرعي غير محسوم (بيانات غير كافية)."
      );
    }

    const res: StockDetailResponse = {
      source: "yahoo",
      asOf: new Date().toISOString(),
      row,
      candles,
      targetsByStrategy,
      analystTargetMean: fund?.targetMeanPrice ?? null,
      analystRecommendation: fund?.recommendationKey ?? null,
      notesAr,
    };
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`stock detail failed for ${ticker}:`, msg);
    return NextResponse.json(
      { error: "تعذّر جلب بيانات السهم من المصدر — حاول مجدداً بعد قليل." },
      { status: 502 }
    );
  }
}
