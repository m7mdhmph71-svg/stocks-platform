"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilterCondition,
  FilterField,
  FilterOp,
  ScreenerResponse,
  StrategyKey,
} from "@/lib/types";
import { PRESETS } from "@/lib/filters/presets";
import { saveSnapshot } from "@/lib/history";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { StockTable } from "@/components/StockTable";
import { FilterBuilder } from "@/components/FilterBuilder";
import { LegendPanel } from "@/components/LegendPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { BacktestPanel } from "@/components/BacktestPanel";
import { SourceBanner } from "@/components/SourceBanner";
import { TableSkeleton } from "@/components/Skeletons";
import { EmptyState, ErrorBox } from "@/components/States";

type Tab = StrategyKey | "custom" | "history";

const STRATEGY_KEYS: StrategyKey[] = ["liquidity", "momentum", "longterm"];

const VALID_FIELDS: FilterField[] = [
  "price",
  "volume",
  "avgVolume3m",
  "relativeVolume",
  "floatShares",
  "marketCap",
  "changePercent",
  "changeFromOpenPercent",
  "weekPerfPercent",
];
const VALID_OPS: FilterOp[] = ["gt", "lt", "gte", "lte", "btwn"];

/** تحليل شروط الفلتر من الرابط بأمان (الخادم يتحقق أيضاً) */
function parseConditionsParam(raw: string | null): FilterCondition[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: FilterCondition[] = [];
    for (const item of parsed) {
      if (item === null || typeof item !== "object") continue;
      const c = item as Record<string, unknown>;
      const field = c.field;
      const op = c.op;
      const value = c.value;
      if (
        typeof field !== "string" ||
        !VALID_FIELDS.includes(field as FilterField)
      )
        continue;
      if (typeof op !== "string" || !VALID_OPS.includes(op as FilterOp))
        continue;
      if (op === "btwn") {
        if (
          !Array.isArray(value) ||
          value.length !== 2 ||
          typeof value[0] !== "number" ||
          typeof value[1] !== "number"
        )
          continue;
        out.push({
          field: field as FilterField,
          op: "btwn",
          value: [value[0], value[1]],
        });
      } else {
        if (typeof value !== "number") continue;
        out.push({ field: field as FilterField, op: op as FilterOp, value });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function ScreenerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetParam = searchParams.get("preset");
  const conditionsParam = searchParams.get("conditions");

  const tab: Tab =
    presetParam === "custom"
      ? "custom"
      : presetParam === "history"
        ? "history"
        : STRATEGY_KEYS.includes(presetParam as StrategyKey)
          ? (presetParam as StrategyKey)
          : "liquidity";

  const customConditions = useMemo(
    () => parseConditionsParam(conditionsParam),
    [conditionsParam]
  );

  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const url = useMemo(() => {
    if (tab === "history") return null;
    if (tab === "custom") {
      if (customConditions.length === 0) return null;
      return (
        "/api/screener?preset=custom&conditions=" +
        encodeURIComponent(JSON.stringify(customConditions))
      );
    }
    return `/api/screener?preset=${tab}`;
  }, [tab, customConditions]);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<ScreenerResponse>(url)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          // لقطة تلقائية لسجل النتائج (تُتجاهل التجريبية والفارغة)
          const nameAr =
            tab === "custom"
              ? "فلتر مخصص"
              : tab !== "history"
                ? PRESETS[tab].nameAr
                : "";
          if (nameAr) saveSnapshot(tab, nameAr, res);
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
  }, [url, refresh, tab]);

  const switchTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams();
      params.set("preset", next);
      if (next === "custom" && conditionsParam) {
        params.set("conditions", conditionsParam);
      }
      router.replace(`/screener?${params.toString()}`);
    },
    [router, conditionsParam]
  );

  const applyConditions = useCallback(
    (conds: FilterCondition[]) => {
      const params = new URLSearchParams();
      params.set("preset", "custom");
      if (conds.length > 0) {
        params.set("conditions", JSON.stringify(conds));
      }
      router.replace(`/screener?${params.toString()}`);
    },
    [router]
  );

  const preset =
    tab !== "custom" && tab !== "history" ? PRESETS[tab] : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          فرز الأسهم
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          اختر استراتيجية جاهزة أو ابنِ فلترك المخصص — مع الفحص الشرعي لكل
          نتيجة.
        </p>
      </div>

      {/* التبويبات */}
      <div
        role="tablist"
        aria-label="استراتيجيات الفرز"
        className="flex flex-wrap gap-2"
      >
        {STRATEGY_KEYS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            onClick={() => switchTab(k)}
            className={
              "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
              (tab === k
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
            }
          >
            {PRESETS[k].nameAr}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={tab === "custom"}
          type="button"
          onClick={() => switchTab("custom")}
          className={
            "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
            (tab === "custom"
              ? "bg-brand-600 text-white shadow-sm"
              : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
          }
        >
          فلتر مخصص
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          type="button"
          onClick={() => switchTab("history")}
          className={
            "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
            (tab === "history"
              ? "bg-brand-600 text-white shadow-sm"
              : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
          }
        >
          السجل
        </button>
      </div>

      {/* السجل: الاختبار التاريخي + لقطات الاستخدام */}
      {tab === "history" ? (
        <>
          <BacktestPanel />
          <div className="pt-2">
            <h2 className="mb-3 font-bold text-zinc-900 dark:text-zinc-50">
              لقطاتك المحفوظة
            </h2>
            <HistoryPanel />
          </div>
        </>
      ) : null}

      {/* وصف الاستراتيجية + اللوحة التوضيحية */}
      {tab === "history" ? null : preset ? (
        <>
          <div className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
                {preset.nameAr}
              </h2>
              <span className="text-sm text-brand-600 dark:text-brand-400">
                {preset.taglineAr}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {preset.descriptionAr}
            </p>
            {preset.advancedNotesAr.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {preset.advancedNotesAr.map((n, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <LegendPanel preset={preset} />
        </>
      ) : (
        <FilterBuilder
          key={conditionsParam ?? "empty"}
          initial={customConditions}
          onApply={applyConditions}
        />
      )}

      {/* النتائج */}
      {tab === "history" ? null : loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => setRefresh((n) => n + 1)} />
      ) : tab === "custom" && customConditions.length === 0 ? (
        <EmptyState
          message="لم تُطبَّق أي شروط بعد."
          hint="أضف شرطاً أو أكثر في المنشئ أعلاه ثم اضغط «تطبيق الفلتر»."
        />
      ) : data ? (
        <div className="space-y-4">
          <SourceBanner source={data.source} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
                {data.total}
              </span>{" "}
              نتيجة
            </span>
            <span>وقت البيانات: {fmtDateTimeAr(data.asOf)}</span>
          </div>
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
          {data.rows.length === 0 ? (
            <EmptyState message="لا نتائج تطابق الشروط الآن." />
          ) : (
            <StockTable rows={data.rows} />
          )}
        </div>
      ) : null}
    </div>
  );
}
