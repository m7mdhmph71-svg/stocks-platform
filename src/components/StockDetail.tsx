"use client";

import { useCallback, useEffect, useState } from "react";
import { Candle, StockDetailResponse, StrategyKey } from "@/lib/types";
import type { ChartRange } from "@/lib/yahoo/chart";
import type { CandlesResponse } from "@/app/api/candles/route";
import type { TickMode } from "@/components/PriceChart";
import {
  changeColorClass,
  currencyFor,
  fmtPercent,
  fmtPrice,
} from "@/lib/format";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { marketOf } from "@/lib/marketHours";
import { SourceBanner } from "@/components/SourceBanner";
import { WatchTradeActions } from "@/components/WatchTradeActions";
import { ShariahBadge } from "@/components/ShariahBadge";
import { ShariahCard } from "@/components/ShariahCard";
import { PurificationCalc } from "@/components/PurificationCalc";
import { TargetsCard } from "@/components/TargetsCard";
import { TechnicalsTable } from "@/components/TechnicalsTable";
import { PriceChart } from "@/components/PriceChart";
import { DetailSkeleton } from "@/components/Skeletons";
import { ErrorBox } from "@/components/States";

/** فترات الرسم البياني بترتيب العرض */
const CHART_RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: "1d", label: "يوم" },
  { key: "5d", label: "أسبوع" },
  { key: "1mo", label: "شهر" },
  { key: "3mo", label: "3 أشهر" },
  { key: "6mo", label: "6 أشهر" },
  { key: "ytd", label: "بداية العام" },
  { key: "1y", label: "سنة" },
  { key: "2y", label: "سنتان" },
  { key: "5y", label: "5 سنوات" },
  { key: "max", label: "الكل" },
];

function tickModeFor(range: ChartRange, intraday: boolean): TickMode {
  if (intraday) return "time";
  if (range === "5y" || range === "max") return "month";
  return "date";
}

export function StockDetail({
  ticker,
  initial,
}: {
  ticker: string;
  /** بيانات مُصيَّرة خادمياً — وجودها يلغي الجلب الأول من المتصفح */
  initial?: StockDetailResponse;
}) {
  const [data, setData] = useState<StockDetailResponse | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  // الافتراضي: الاستراتيجية الملائمة للسهم (من محرك fit) — لا «صيد السيولة» للجميع
  const [strategy, setStrategy] = useState<StrategyKey>(
    initial?.fit.closest ?? "trend"
  );

  // الرسم البياني: «سنة» تأتي مع استجابة السهم، وبقية الفترات تُجلب عند الطلب
  const [range, setRange] = useState<ChartRange>("1y");
  const [rangeCandles, setRangeCandles] = useState<Candle[] | null>(null);
  const [rangeIntraday, setRangeIntraday] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    // البيانات الخادمية تغني عن الجلب الأول — يُعاد الجلب فقط عند «إعادة المحاولة»
    if (initial && refresh === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRange("1y");
    setRangeCandles(null);
    setRangeIntraday(false);
    setChartError(null);
    fetchJson<StockDetailResponse>(
      `/api/stock/${encodeURIComponent(ticker)}`
    )
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setStrategy(res.fit.closest);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "خطأ غير متوقع.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, refresh, initial]);

  const retry = useCallback(() => setRefresh((n) => n + 1), []);

  const switchRange = useCallback(
    (next: ChartRange) => {
      setRange(next);
      setChartError(null);
      if (next === "1y") {
        // فترة «سنة» موجودة سلفاً في استجابة السهم — لا حاجة لطلب جديد
        setRangeCandles(null);
        setRangeIntraday(false);
        return;
      }
      setChartLoading(true);
      fetchJson<CandlesResponse>(
        `/api/candles?ticker=${encodeURIComponent(ticker)}&range=${next}`
      )
        .then((res) => {
          setRangeCandles(res.candles);
          setRangeIntraday(res.intraday);
        })
        .catch((e: unknown) => {
          setRangeCandles(null);
          setRangeIntraday(false);
          setChartError(
            e instanceof Error ? e.message : "تعذّر جلب بيانات الفترة."
          );
        })
        .finally(() => setChartLoading(false));
    },
    [ticker]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <ErrorBox
          message={error ?? "تعذّر جلب بيانات السهم."}
          onRetry={retry}
        />
      </div>
    );
  }

  const { row, targetsByStrategy } = data;
  const selected = targetsByStrategy[strategy];
  const currency = currencyFor(row.ticker);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <SourceBanner source={data.source} />

      {/* الرأس */}
      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1
                dir="ltr"
                className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {row.ticker}
              </h1>
              <ShariahBadge shariah={row.shariah} size="lg" />
            </div>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">{row.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <MarketStatusBadge market={marketOf(row.ticker)} />
              {row.exchange ? <span className="chip">{row.exchange}</span> : null}
              {row.sector ? <span className="chip">{row.sector}</span> : null}
              {row.industry ? (
                <span className="chip">{row.industry}</span>
              ) : null}
            </div>
            <div className="mt-4">
              <WatchTradeActions
                ticker={row.ticker}
                price={row.price}
                targets={selected}
              />
            </div>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {fmtPrice(row.price, currency)}
            </p>
            <p
              className={`mt-1 text-lg font-medium tabular-nums ${changeColorClass(
                row.changePercent
              )}`}
            >
              {fmtPercent(row.changePercent)}
            </p>
            {row.changeFromOpenPercent !== null ? (
              <p
                className={`text-xs tabular-nums ${changeColorClass(
                  row.changeFromOpenPercent
                )}`}
              >
                من الافتتاح {fmtPercent(row.changeFromOpenPercent)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* الجوهر أولاً: الحكم الشرعي والخطة الملائمة جنباً إلى جنب —
          grid-cols-1 صراحةً كي يُحدّ العمود بـ minmax(0,1fr) في الجوال */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <ShariahCard shariah={row.shariah} />
        </div>
        <div className="min-w-0">
          <TargetsCard
            currency={currency}
            fit={data.fit}
            byStrategy={targetsByStrategy}
            selected={strategy}
            onSelect={setStrategy}
            analystTarget={data.analystTargetMean}
            analystRecommendation={data.analystRecommendation}
          />
        </div>
      </div>

      {/* الرسم البياني */}
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            الرسم البياني —{" "}
            {CHART_RANGES.find((r) => r.key === range)?.label ?? range}
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            المستويات المعروضة وفق استراتيجية «{selected.strategyAr}»
          </span>
        </div>

        {/* اختيار الفترة الزمنية */}
        <div
          className="mb-4 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="فترة الرسم البياني"
        >
          {CHART_RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              type="button"
              onClick={() => switchRange(r.key)}
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                (range === r.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        {chartError ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            {chartError} — يُعرض آخر رسم متاح.
          </p>
        ) : null}

        <div className={chartLoading ? "animate-pulse opacity-60" : undefined}>
          <PriceChart
            candles={rangeCandles ?? data.candles}
            targets={selected.targets.map((t) => ({
              label: t.label,
              price: t.price,
            }))}
            stopLoss={selected.stopLoss}
            sma50={selected.indicators.sma50}
            sma200={selected.indicators.sma200}
            tickMode={tickModeFor(range, rangeIntraday)}
            currency={currency}
          />
        </div>
      </section>

      {/* تفاصيل إضافية — مطوية كي لا تزاحم الجوهر */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <details className="card min-w-0 overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 font-bold text-zinc-900 transition-colors hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800/50">
            المؤشرات الفنية التفصيلية
          </summary>
          <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
            <TechnicalsTable indicators={selected.indicators} currency={currency} />
          </div>
        </details>
        <details className="card min-w-0 overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 font-bold text-zinc-900 transition-colors hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800/50">
            حاسبة التطهير اليدوية
          </summary>
          <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
            <PurificationCalc shariah={row.shariah} />
          </div>
        </details>
      </div>

      {/* ملاحظات */}
      {data.notesAr.length > 0 ? (
        <ul className="space-y-1">
          {data.notesAr.map((n, i) => (
            <li
              key={i}
              className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        وقت البيانات: {fmtDateTimeAr(data.asOf)}
      </p>
    </div>
  );
}
