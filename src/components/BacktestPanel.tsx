"use client";

// الاختبار التاريخي للفلاتر: يعيد بناء نتائج الفلتر في الجلسات الماضية
// ويعرض أداءها بعد الإشارة — تقييم موضوعي لجودة الفلتر.

import { useCallback, useState } from "react";
import Link from "next/link";
import { fetchJson, fmtShortDateAr } from "@/components/ui";
import { fmtPercent, fmtPrice, changeColorClass } from "@/lib/format";
import { ErrorBox } from "@/components/States";
import type {
  BacktestCompareResponse,
  BacktestResponse,
} from "@/app/api/backtest/route";

type Strategy = "trend" | "liquidity";

const STRATEGY_LABELS: Record<Strategy, string> = {
  trend: "الاتجاه الصاعد",
  liquidity: "صيد السيولة",
};

/** خيارات النافذة: المضاربة قصيرة، والاتجاه يحتاج مدى يكتمل فيه أفقه (30 جلسة) */
const DAY_OPTIONS_BY_STRATEGY: Record<Strategy, number[]> = {
  trend: [60, 90, 120, 150],
  liquidity: [10, 20, 30, 40],
};

const OUTCOME_CHIP: Record<
  string,
  { label: string; cls: string }
> = {
  target: {
    label: "هدف ✓",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  stop: {
    label: "وقف ✗",
    cls: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  time: {
    label: "خروج زمني",
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  open: {
    label: "جارية",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
};

function OutcomeChip({ outcome }: { outcome: string }) {
  const c = OUTCOME_CHIP[outcome] ?? OUTCOME_CHIP.time;
  return (
    <span
      className={
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " +
        c.cls
      }
    >
      {c.label}
    </span>
  );
}

function StatTile({
  label,
  value,
  colorClass,
  hint,
}: {
  label: string;
  value: string;
  colorClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={
          "mt-1 text-lg font-bold tabular-nums " +
          (colorClass ?? "text-zinc-900 dark:text-zinc-50")
        }
        dir="ltr"
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function BacktestPanel() {
  const [strategy, setStrategy] = useState<Strategy>("trend");
  const [days, setDays] = useState(120);

  const switchStrategy = useCallback((k: Strategy) => {
    setStrategy(k);
    // مدة افتراضية مناسبة للاستراتيجية الجديدة
    setDays(k === "trend" ? 120 : 30);
  }, []);
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranFor, setRanFor] = useState<string | null>(null);
  const [compare, setCompare] = useState<BacktestCompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const key = `${strategy}:${days}`;
    fetchJson<BacktestResponse>(`/api/backtest?preset=${strategy}&days=${days}`)
      .then((res) => {
        setData(res);
        setRanFor(key);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "تعذّر تنفيذ الاختبار.");
      })
      .finally(() => setLoading(false));
  }, [strategy, days]);

  const runCompare = useCallback(() => {
    setComparing(true);
    setError(null);
    setCompare(null);
    fetchJson<BacktestCompareResponse>(
      `/api/backtest?preset=${strategy}&days=${days}&compare=1`
    )
      .then(setCompare)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "تعذّرت المقارنة.");
      })
      .finally(() => setComparing(false));
  }, [strategy, days]);

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          الاختبار التاريخي للفلتر
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          نعيد بناء شروط الفلتر على الجلسات الماضية لنعرف أي الأسهم كانت
          ستظهر فيه كل يوم، ثم نقيس ما فعلته بعد الإشارة — حكمٌ موضوعي على
          جودة الفلتر قبل أن تثق به.
        </p>
      </div>

      {/* أدوات التشغيل */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => switchStrategy(k)}
            className={
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
              (strategy === k
                ? "bg-brand-600 text-white"
                : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300")
            }
          >
            {STRATEGY_LABELS[k]}
          </button>
        ))}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label="عدد الجلسات"
        >
          {DAY_OPTIONS_BY_STRATEGY[strategy].map((d) => (
            <option key={d} value={d}>
              آخر {d} جلسة
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={loading || comparing}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "جارٍ الاختبار…" : "شغّل الاختبار"}
        </button>
        <button
          type="button"
          onClick={runCompare}
          disabled={loading || comparing}
          className="rounded-lg border border-brand-500 px-4 py-1.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
        >
          {comparing ? "جارٍ المقارنة…" : "⚖️ قارن صيغ الهدف/الوقف"}
        </button>
      </div>

      {comparing ? (
        <div className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent align-middle" />{" "}
          نحاكي كل إشارة بست صيغ خروج مختلفة — قد يستغرق دقائق أول مرة.
        </div>
      ) : null}

      {compare && !comparing ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
              أي صيغة هدف/وقف كانت الأفضل؟
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              نفس {compare.totalSignals} إشارة عبر {compare.daysTested} جلسة،
              حوكيت بست طرق خروج — القرار بالأرقام لا بالانطباع.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <th className="p-2.5 text-start font-medium">الصيغة</th>
                  <th className="p-2.5 text-end font-medium">صفقات محسومة</th>
                  <th className="p-2.5 text-end font-medium">نسبة رابحة</th>
                  <th className="p-2.5 text-end font-medium">متوسط العائد</th>
                  <th className="p-2.5 text-end font-medium">معامل الربح</th>
                  <th className="p-2.5 text-end font-medium">
                    هامش الأمان
                    <span className="block text-[10px] font-normal text-zinc-400">
                      إصابة − تعادل
                    </span>
                  </th>
                  <th className="p-2.5 text-end font-medium">متوسط الجلسات</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const bestPf = Math.max(
                    ...compare.variants.map((v) => v.profitFactor ?? -Infinity)
                  );
                  return compare.variants.map((v) => {
                    const isBest =
                      v.profitFactor !== null && v.profitFactor === bestPf;
                    return (
                      <tr
                        key={v.key}
                        className={
                          "border-b border-zinc-100 last:border-0 dark:border-zinc-800/60 " +
                          (isBest ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "")
                        }
                      >
                        <td className="p-2.5">
                          <span className="font-bold text-zinc-900 dark:text-zinc-50">
                            {v.labelAr}
                          </span>
                          {isBest ? (
                            <span className="ms-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              الأفضل
                            </span>
                          ) : null}
                          {v.key === "structure" ? (
                            <span className="ms-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              المعتمدة للعرض
                            </span>
                          ) : null}
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {v.descriptionAr}
                          </span>
                        </td>
                        <td className="p-2.5 text-end tabular-nums text-zinc-700 dark:text-zinc-200">
                          {v.closedTrades}
                        </td>
                        <td className="p-2.5 text-end tabular-nums text-zinc-700 dark:text-zinc-200">
                          {v.winRate !== null ? v.winRate.toFixed(0) + "%" : "—"}
                        </td>
                        <td
                          className={
                            "p-2.5 text-end font-bold tabular-nums " +
                            changeColorClass(v.avgTradeReturn)
                          }
                        >
                          <span dir="ltr">{fmtPercent(v.avgTradeReturn)}</span>
                        </td>
                        <td
                          className={
                            "p-2.5 text-end tabular-nums " +
                            (v.profitFactor !== null
                              ? v.profitFactor >= 1
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                              : "")
                          }
                        >
                          {v.profitFactor !== null
                            ? v.profitFactor.toFixed(2)
                            : "—"}
                        </td>
                        <td
                          className={
                            "p-2.5 text-end tabular-nums " +
                            (v.safetyMarginPct !== null
                              ? v.safetyMarginPct >= 15
                                ? "font-bold text-emerald-600 dark:text-emerald-400"
                                : v.safetyMarginPct >= 5
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "font-bold text-red-600 dark:text-red-400"
                              : "")
                          }
                          title={
                            v.breakEvenWinRate !== null
                              ? `تتعادل عند إصابة ${v.breakEvenWinRate.toFixed(0)}% — كلما زاد الهامش زاد أمان الصيغة أمام تراجع الإصابة`
                              : undefined
                          }
                        >
                          {v.safetyMarginPct !== null
                            ? `${v.safetyMarginPct >= 0 ? "+" : ""}${v.safetyMarginPct.toFixed(0)} نقطة`
                            : "—"}
                        </td>
                        <td className="p-2.5 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                          {v.avgSessionsHeld !== null
                            ? v.avgSessionsHeld.toFixed(1)
                            : "—"}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1">
            {compare.notesAr.map((n, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent align-middle" />{" "}
          نفحص مئات الأسهم عبر {days} جلسة — قد يستغرق حتى دقيقة أول مرة،
          والنتائج تُحفظ بعدها.
        </div>
      ) : null}

      {error ? <ErrorBox message={error} onRetry={run} /> : null}

      {data && !loading ? (
        <div className="space-y-4">
          {/* الملخص: محاكاة خطة الهدف/الوقف */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="الصفقات المحسومة"
              value={String(data.summary.closedTrades)}
              hint={
                `${data.summary.totalSignals} إشارة في ${data.summary.daysWithSignals} جلسة` +
                (data.summary.openTrades > 0
                  ? ` · ${data.summary.openTrades} جارية`
                  : "")
              }
            />
            <StatTile
              label="أصابت الهدف"
              value={fmtPercent(data.summary.targetHitRate, 0).replace("+", "")}
              colorClass="text-emerald-600 dark:text-emerald-400"
              hint={`${data.summary.targetHits} صفقة`}
            />
            <StatTile
              label="ضربت الوقف"
              value={fmtPercent(data.summary.stopHitRate, 0).replace("+", "")}
              colorClass="text-red-600 dark:text-red-400"
              hint={`${data.summary.stopHits} صفقة · ${data.summary.timeExits} خروج زمني`}
            />
            <StatTile
              label="متوسط عائد الصفقة"
              value={fmtPercent(data.summary.avgTradeReturn)}
              colorClass={changeColorClass(data.summary.avgTradeReturn)}
            />
            <StatTile
              label="معامل الربح"
              value={
                data.summary.profitFactor !== null
                  ? data.summary.profitFactor.toFixed(2)
                  : "—"
              }
              colorClass={
                data.summary.profitFactor !== null
                  ? data.summary.profitFactor >= 1
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                  : undefined
              }
              hint="الأرباح ÷ الخسائر (فوق 1 = رابح)"
            />
            <StatTile
              label="متوسط مدة الصفقة"
              value={
                data.summary.avgSessionsHeld !== null
                  ? data.summary.avgSessionsHeld.toFixed(1)
                  : "—"
              }
              hint="جلسات حتى الخروج"
            />
          </div>

          {data.summary.best && data.summary.worst ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">
                أفضل صفقة:{" "}
                <Link
                  href={`/stock/${data.summary.best.ticker}`}
                  className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                  dir="ltr"
                >
                  {data.summary.best.ticker}
                </Link>{" "}
                <span
                  className={
                    "font-bold " +
                    changeColorClass(data.summary.best.tradeReturnPercent)
                  }
                  dir="ltr"
                >
                  {fmtPercent(data.summary.best.tradeReturnPercent)}
                </span>
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">
                أسوأ صفقة:{" "}
                <Link
                  href={`/stock/${data.summary.worst.ticker}`}
                  className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                  dir="ltr"
                >
                  {data.summary.worst.ticker}
                </Link>{" "}
                <span
                  className={
                    "font-bold " +
                    changeColorClass(data.summary.worst.tradeReturnPercent)
                  }
                  dir="ltr"
                >
                  {fmtPercent(data.summary.worst.tradeReturnPercent)}
                </span>
              </span>
            </div>
          ) : null}

          {/* ملاحظات المنهجية */}
          <ul className="space-y-1">
            {data.notesAr.map((n, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {n}
              </li>
            ))}
          </ul>

          {/* الإشارات يوماً بيوم */}
          {data.days.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              لم يُصدر الفلتر أي إشارة خلال آخر {days} جلسة — الفلاتر
              الانتقائية قد تصمت أياماً، وهذا بحد ذاته معلومة.
            </p>
          ) : (
            <div className="space-y-3">
              {data.days.map((d) => (
                <details
                  key={d.time}
                  className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                  open={d === data.days[0]}
                >
                  <summary className="cursor-pointer bg-zinc-50 px-4 py-2.5 text-sm font-bold text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:bg-zinc-800">
                    {fmtShortDateAr(d.time)} —{" "}
                    <span className="tabular-nums">{d.signals.length}</span>{" "}
                    {d.signals.length === 1 ? "إشارة" : "إشارات"}
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          <th className="p-2.5 text-start font-medium">الرمز</th>
                          <th className="p-2.5 text-end font-medium">الدخول</th>
                          <th className="p-2.5 text-end font-medium">الهدف</th>
                          <th className="p-2.5 text-end font-medium">الوقف</th>
                          <th className="p-2.5 text-start font-medium">النتيجة</th>
                          <th className="p-2.5 text-end font-medium">عائد الصفقة</th>
                          <th className="p-2.5 text-end font-medium">الجلسات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.signals.map((s) => (
                          <tr
                            key={s.ticker + s.time}
                            className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                          >
                            <td className="p-2.5">
                              <Link
                                href={`/stock/${s.ticker}`}
                                className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                                dir="ltr"
                              >
                                {s.ticker}
                              </Link>
                              <span className="ms-2 hidden max-w-[10rem] truncate align-middle text-xs text-zinc-400 sm:inline-block dark:text-zinc-500">
                                {s.name}
                              </span>
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-zinc-900 dark:text-zinc-50">
                              {fmtPrice(s.price)}
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-emerald-700 dark:text-emerald-400">
                              {fmtPrice(s.target)}
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-red-700 dark:text-red-400">
                              {fmtPrice(s.stop)}
                            </td>
                            <td className="p-2.5">
                              <OutcomeChip outcome={s.outcome} />
                            </td>
                            <td
                              className={
                                "p-2.5 text-end font-bold tabular-nums " +
                                changeColorClass(s.tradeReturnPercent)
                              }
                            >
                              <span dir="ltr">
                                {fmtPercent(s.tradeReturnPercent, 1)}
                              </span>
                              {s.outcome === "open" ? (
                                <span className="ms-1 align-middle text-[10px] font-normal text-zinc-400">
                                  غير محقق
                                </span>
                              ) : null}
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                              {s.sessionsHeld ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
