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
import { SAUDI_PRESET } from "@/lib/filters/saudi";
import { saveSnapshot } from "@/lib/history";
import { buildShareMessage } from "@/lib/whatsapp/format";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { StockTable } from "@/components/StockTable";
import { FilterBuilder } from "@/components/FilterBuilder";
import { LegendPanel } from "@/components/LegendPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { BacktestPanel } from "@/components/BacktestPanel";
import { SourceBanner } from "@/components/SourceBanner";
import { TableSkeleton } from "@/components/Skeletons";
import { EmptyState, ErrorBox } from "@/components/States";

type Tab = StrategyKey | "saudi" | "custom" | "history";

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
        : presetParam === "saudi"
          ? "saudi"
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
              : tab === "saudi"
                ? SAUDI_PRESET.nameAr
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
    tab !== "custom" && tab !== "history" && tab !== "saudi"
      ? PRESETS[tab]
      : null;
  /** بطاقة الوصف: الاستراتيجيات من PRESETS والسعودي من إعداده المستقل */
  const info = tab === "saudi" ? SAUDI_PRESET : preset;

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
          aria-selected={tab === "saudi"}
          type="button"
          onClick={() => switchTab("saudi")}
          className={
            "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
            (tab === "saudi"
              ? "bg-brand-600 text-white shadow-sm"
              : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
          }
        >
          {SAUDI_PRESET.nameAr}
        </button>
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
      {tab === "history" ? null : info ? (
        <>
          <div className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
                {info.nameAr}
              </h2>
              <span className="text-sm text-brand-600 dark:text-brand-400">
                {info.taglineAr}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {info.descriptionAr}
            </p>
            {info.advancedNotesAr.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {info.advancedNotesAr.map((n, i) => (
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
          {/* اللوحة التوضيحية لدلالات Finviz — للفلاتر الأمريكية فقط */}
          {preset ? <LegendPanel preset={preset} /> : null}
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
                {data.total}
              </span>{" "}
              نتيجة
            </span>
            <span>وقت البيانات: {fmtDateTimeAr(data.asOf)}</span>
            {data.rows.length > 0 ? (
              <a
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(
                    buildShareMessage(
                      info ? info.nameAr : "فلتر مخصص",
                      data.rows,
                      new Date()
                    )
                  )
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                  <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.9 7c0 5.45-4.44 9.88-9.9 9.88zm8.42-18.3A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.94L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.9 0-3.18-1.24-6.16-3.47-8.4z" />
                </svg>
                شارك على واتساب
              </a>
            ) : null}
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
