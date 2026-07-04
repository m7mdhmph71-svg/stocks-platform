"use client";

import { useCallback, useEffect, useState } from "react";
import { StockDetailResponse, StrategyKey } from "@/lib/types";
import {
  changeColorClass,
  fmtPercent,
  fmtPrice,
} from "@/lib/format";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { SourceBanner } from "@/components/SourceBanner";
import { ShariahBadge } from "@/components/ShariahBadge";
import { ShariahCard } from "@/components/ShariahCard";
import { PurificationCalc } from "@/components/PurificationCalc";
import { TargetsCard } from "@/components/TargetsCard";
import { TechnicalsTable } from "@/components/TechnicalsTable";
import { PriceChart } from "@/components/PriceChart";
import { DetailSkeleton } from "@/components/Skeletons";
import { ErrorBox } from "@/components/States";

export function StockDetail({ ticker }: { ticker: string }) {
  const [data, setData] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [strategy, setStrategy] = useState<StrategyKey>("liquidity");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<StockDetailResponse>(
      `/api/stock/${encodeURIComponent(ticker)}`
    )
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [ticker, refresh]);

  const retry = useCallback(() => setRefresh((n) => n + 1), []);

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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.exchange ? <span className="chip">{row.exchange}</span> : null}
              {row.sector ? <span className="chip">{row.sector}</span> : null}
              {row.industry ? (
                <span className="chip">{row.industry}</span>
              ) : null}
            </div>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {fmtPrice(row.price)}
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

      {/* الشرعية والأهداف — grid-cols-1 صراحةً كي يُحدّ العمود بـ minmax(0,1fr)
          فلا يوسّعه نص غير قابل للكسر (truncate) في الجوال */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <ShariahCard shariah={row.shariah} />
          <PurificationCalc shariah={row.shariah} />
        </div>
        <div className="min-w-0 space-y-6">
          <TargetsCard
            byStrategy={targetsByStrategy}
            selected={strategy}
            onSelect={setStrategy}
            analystTarget={data.analystTargetMean}
            analystRecommendation={data.analystRecommendation}
          />
          <TechnicalsTable indicators={selected.indicators} />
        </div>
      </div>

      {/* الرسم البياني */}
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            الرسم البياني — سنة
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            المستويات المعروضة وفق استراتيجية «{selected.strategyAr}»
          </span>
        </div>
        <PriceChart
          candles={data.candles}
          targets={selected.targets.map((t) => ({
            label: t.label,
            price: t.price,
          }))}
          stopLoss={selected.stopLoss}
          sma50={selected.indicators.sma50}
          sma200={selected.indicators.sma200}
        />
      </section>

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
