"use client";

// سجل نتائج الفلاتر السابقة: لقطات محفوظة على جهاز المستخدم، مع مقارنة
// سعر كل سهم حين ظهوره في الفلتر بسعره الحالي والعائد منذ ذلك الحين.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShariahVerdict } from "@/lib/types";
import {
  Snapshot,
  clearSnapshots,
  deleteSnapshot,
  loadSnapshots,
} from "@/lib/history";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { fmtPercent, fmtPrice, changeColorClass } from "@/lib/format";
import { EmptyState, ErrorBox } from "@/components/States";

interface QuotesResponse {
  quotes: Record<string, { price: number; changePercent: number | null }>;
  asOf: string;
}

const VERDICT_CHIP: Record<
  ShariahVerdict,
  { label: string; cls: string }
> = {
  COMPLIANT: {
    label: "متوافق",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  MIXED: {
    label: "مختلط",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  NON_COMPLIANT: {
    label: "غير متوافق",
    cls: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  UNKNOWN: {
    label: "غير معروف",
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

function fmtDateAr(dateKey: string): string {
  try {
    return new Date(dateKey + "T12:00:00").toLocaleDateString("ar-u-nu-latn", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateKey;
  }
}

export function HistoryPanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuotesResponse["quotes"] | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // التحميل بعد التركيب فقط (localStorage غير متاح في الخادم)
  useEffect(() => {
    const loaded = loadSnapshots();
    setSnapshots(loaded);
    setSelectedId((cur) => cur ?? loaded[0]?.id ?? null);
  }, []);

  const selected = useMemo(
    () => snapshots.find((s) => s.id === selectedId) ?? null,
    [snapshots, selectedId]
  );

  // جلب الأسعار الحالية للقطة المختارة
  useEffect(() => {
    if (!selected || selected.rows.length === 0) {
      setQuotes(null);
      return;
    }
    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(null);
    setQuotes(null);
    const tickers = selected.rows.map((r) => r.ticker).join(",");
    fetchJson<QuotesResponse>(`/api/quotes?tickers=${encodeURIComponent(tickers)}`)
      .then((res) => {
        if (!cancelled) setQuotes(res.quotes);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setQuotesError(
            e instanceof Error ? e.message : "تعذّر جلب الأسعار الحالية."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, retry]);

  const onDelete = useCallback((id: string) => {
    deleteSnapshot(id);
    const next = loadSnapshots();
    setSnapshots(next);
    setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
  }, []);

  const onClearAll = useCallback(() => {
    clearSnapshots();
    setSnapshots([]);
    setSelectedId(null);
  }, []);

  if (snapshots.length === 0) {
    return (
      <EmptyState
        message="لا يوجد سجل بعد."
        hint="السجل يُبنى تلقائياً: كلما فتحت أحد الفلاتر وأعطى نتائج حية، حُفظت لقطة بتاريخها على هذا الجهاز — ثم تعود هنا لترى كيف تحركت الأسهم بعد ظهورها."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          لقطات محفوظة على هذا الجهاز — لقطة واحدة لكل فلتر في اليوم، وتشمل
          أول 30 نتيجة.
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-red-400"
        >
          مسح السجل كاملاً
        </button>
      </div>

      {/* قائمة اللقطات */}
      <div className="flex flex-wrap gap-2">
        {snapshots.map((s) => (
          <div key={s.id} className="relative">
            <button
              type="button"
              onClick={() => setSelectedId(s.id)}
              className={
                "rounded-xl border px-3 py-2 text-start text-xs transition-colors " +
                (s.id === selectedId
                  ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/40"
                  : "border-zinc-300 bg-white hover:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900")
              }
            >
              <span className="block font-bold text-zinc-900 dark:text-zinc-50">
                {s.presetNameAr}
              </span>
              <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
                {fmtDateAr(s.dateKey)} · {s.total} نتيجة
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* تفاصيل اللقطة المختارة */}
      {selected ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                {selected.presetNameAr} — {fmtDateAr(selected.dateKey)}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                وقت الرصد: {fmtDateTimeAr(selected.savedAt)}
                {selected.total > selected.rows.length
                  ? ` · حُفظت ${selected.rows.length} من ${selected.total} نتيجة`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(selected.id)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-red-400"
            >
              حذف هذه اللقطة
            </button>
          </div>

          {quotesError ? (
            <div className="p-4">
              <ErrorBox
                message={quotesError}
                onRetry={() => setRetry((n) => n + 1)}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="p-3 text-start font-medium">الرمز</th>
                  <th className="p-3 text-start font-medium">الاسم</th>
                  <th className="p-3 text-start font-medium">الشرعية حينها</th>
                  <th className="p-3 text-end font-medium">السعر حينها</th>
                  <th className="p-3 text-end font-medium">السعر الآن</th>
                  <th className="p-3 text-end font-medium">العائد منذ الرصد</th>
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((r) => {
                  const now = quotes?.[r.ticker]?.price ?? null;
                  const ret =
                    now !== null && r.price > 0
                      ? ((now - r.price) / r.price) * 100
                      : null;
                  const chip = r.verdict ? VERDICT_CHIP[r.verdict] : null;
                  return (
                    <tr
                      key={r.ticker}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                    >
                      <td className="p-3">
                        <Link
                          href={`/stock/${r.ticker}`}
                          className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                          dir="ltr"
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] truncate p-3 text-zinc-600 dark:text-zinc-300">
                        {r.name}
                      </td>
                      <td className="p-3">
                        {chip ? (
                          <span
                            className={
                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium " +
                              chip.cls
                            }
                          >
                            {chip.label}
                            {r.verdict === "MIXED" &&
                            r.purificationRatio !== null
                              ? ` · تطهير ${r.purificationRatio}%`
                              : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-end tabular-nums text-zinc-900 dark:text-zinc-50">
                        {fmtPrice(r.price)}
                      </td>
                      <td className="p-3 text-end tabular-nums text-zinc-900 dark:text-zinc-50">
                        {quotesLoading ? (
                          <span className="inline-block h-3 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                        ) : (
                          fmtPrice(now)
                        )}
                      </td>
                      <td
                        className={
                          "p-3 text-end font-bold tabular-nums " +
                          changeColorClass(ret)
                        }
                      >
                        {quotesLoading ? (
                          <span className="inline-block h-3 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                        ) : (
                          <span dir="ltr">{fmtPercent(ret)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="border-t border-zinc-200 p-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            العائد محسوب من سعر السهم لحظة رصده في الفلتر إلى آخر سعر متاح —
            أداة تقييم لجودة الفلتر وليست توصية.
          </p>
        </div>
      ) : null}
    </div>
  );
}
