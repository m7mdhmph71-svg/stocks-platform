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
import { PRESETS, STRATEGY_NAMES_AR } from "@/lib/filters/presets";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { SAUDI_PRESET } from "@/lib/filters/saudi";
import { TREND_PRESET } from "@/lib/filters/trend";
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

/** العرض الحالي: استراتيجية أو أداة (مخصص/سجل) — السوق بُعد مستقل */
type Tab = StrategyKey | "custom" | "history";
type Market = "us" | "sa";

const STRATEGIES: StrategyKey[] = ["liquidity", "momentum", "trend", "longterm"];

const MARKET_LABELS: Record<Market, string> = {
  us: "السوق الأمريكي",
  sa: "السوق السعودي",
};

/** مفتاح الـ API للسوق والاستراتيجية — null = غير متاحة لهذا السوق بعد */
function presetKeyFor(market: Market, strategy: StrategyKey): string | null {
  if (market === "us") return strategy;
  if (strategy === "momentum") return "saudi";
  if (strategy === "trend") return "saudi-trend";
  return null; // السيولة والاستثمار: بيانات تداول لا تكفيهما بعد
}

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

/** رسالة تحميل حية بعدّاد — أول فرز يفحص مئات الأسهم وقد يستغرق دقيقة */
function LoadingNotice() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <span className="me-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent align-middle" />
      نفرز السوق ونجري الفحص الشرعي لكل نتيجة…
      {seconds >= 8 ? (
        <span className="ms-1">
          أول تحميل يفحص مئات الأسهم وقد يستغرق حتى دقيقة — النتائج تُخبَّأ
          بعدها <span className="tabular-nums" dir="ltr">({seconds}ث)</span>
        </span>
      ) : null}
    </div>
  );
}

export function ScreenerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetParam = searchParams.get("preset");
  const conditionsParam = searchParams.get("conditions");

  // (سوق، عرض) من معامل رابط واحد — الروابط القديمة تعمل كما هي
  const market: Market =
    presetParam === "saudi" || presetParam === "saudi-trend" ? "sa" : "us";
  const tab: Tab =
    presetParam === "custom"
      ? "custom"
      : presetParam === "history"
        ? "history"
        : presetParam === "saudi"
          ? "momentum"
          : presetParam === "saudi-trend"
            ? "trend"
            : STRATEGIES.includes(presetParam as StrategyKey)
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
    const key = presetKeyFor(market, tab);
    return key ? `/api/screener?preset=${key}` : null;
  }, [tab, market, customConditions]);

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
                ? `${STRATEGY_NAMES_AR[tab]}${market === "sa" ? " — تداول" : ""}`
                : "";
          if (nameAr) saveSnapshot(res.preset, nameAr, res);
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

  const go = useCallback(
    (presetKey: string, withConditions = false) => {
      const params = new URLSearchParams();
      params.set("preset", presetKey);
      if (withConditions && conditionsParam) {
        params.set("conditions", conditionsParam);
      }
      router.replace(`/screener?${params.toString()}`);
    },
    [router, conditionsParam]
  );

  const switchStrategy = useCallback(
    (k: StrategyKey) => {
      const key = presetKeyFor(market, k);
      if (key) go(key);
    },
    [market, go]
  );

  const switchMarket = useCallback(
    (m: Market) => {
      const current: StrategyKey =
        tab === "custom" || tab === "history" ? "momentum" : tab;
      const key = presetKeyFor(m, current) ?? presetKeyFor(m, "momentum");
      if (key) go(key);
    },
    [tab, go]
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

  /** لوحة دلالات Finviz — لفلاتر السوق الأمريكي الثلاثة الأصلية فقط */
  const preset =
    market === "us" && tab !== "custom" && tab !== "history" && tab !== "trend"
      ? PRESETS[tab]
      : null;
  /** بطاقة الوصف بحسب (السوق، الاستراتيجية) */
  const info =
    tab === "custom" || tab === "history"
      ? null
      : market === "sa"
        ? tab === "momentum"
          ? SAUDI_PRESET
          : {
              ...TREND_PRESET,
              advancedNotesAr: [
                "نسخة تداول: كون جودة سعودي (سعر ≥ 5 ر.س، قيمة سوقية ≥ مليار ريال، متوسط حجم ≥ 100 ألف).",
                ...TREND_PRESET.advancedNotesAr,
              ],
            }
        : tab === "trend"
          ? TREND_PRESET
          : PRESETS[tab];

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

      {/* ١) اختيار السوق + حالته الحية */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="السوق"
          className="flex gap-1 rounded-full border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {(["us", "sa"] as Market[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={market === m && tab !== "custom" && tab !== "history"}
              type="button"
              onClick={() => switchMarket(m)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-bold transition-colors " +
                (market === m
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-zinc-600 hover:text-brand-700 dark:text-zinc-300 dark:hover:text-brand-400")
              }
            >
              {MARKET_LABELS[m]}
            </button>
          ))}
        </div>
        <MarketStatusBadge market={market} />
      </div>

      {/* ٢) الاستراتيجية */}
      <div
        role="tablist"
        aria-label="الاستراتيجية"
        className="flex flex-wrap gap-2"
      >
        {STRATEGIES.map((k) => {
          const available = presetKeyFor(market, k) !== null;
          const active = tab === k;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active}
              type="button"
              disabled={!available}
              title={available ? undefined : "قريباً للسوق السعودي — بيانات المصدر لا تكفيها بعد"}
              onClick={() => switchStrategy(k)}
              className={
                "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-brand-600 text-white shadow-sm"
                  : available
                    ? "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400"
                    : "cursor-not-allowed border border-dashed border-zinc-200 bg-transparent text-zinc-300 dark:border-zinc-800 dark:text-zinc-600")
              }
            >
              {STRATEGY_NAMES_AR[k]}
              {!available ? <span className="ms-1 text-[10px]">قريباً</span> : null}
            </button>
          );
        })}
      </div>

      {/* ٣) الأدوات */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => go("custom", true)}
          className={
            "underline-offset-4 transition-colors " +
            (tab === "custom"
              ? "font-bold text-brand-700 underline dark:text-brand-400"
              : "text-zinc-500 hover:text-brand-700 hover:underline dark:text-zinc-400 dark:hover:text-brand-400")
          }
        >
          فلتر مخصص
        </button>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>
        <button
          type="button"
          onClick={() => go("history")}
          className={
            "underline-offset-4 transition-colors " +
            (tab === "history"
              ? "font-bold text-brand-700 underline dark:text-brand-400"
              : "text-zinc-500 hover:text-brand-700 hover:underline dark:text-zinc-400 dark:hover:text-brand-400")
          }
        >
          السجل واللقطات
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
        <>
          <LoadingNotice />
          <TableSkeleton />
        </>
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
