"use client";

// صفحة «تطهير محفظتي»: مبلغ التطهير المستحق عن الصفقات المغلقة —
// إجماليات بالفترة ثم جدول تفصيلي لكل صفقة.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { fetchJson, fmtDollar } from "@/components/ui";
import { fmtPrice, fmtNum, changeColorClass } from "@/lib/format";
import { ErrorBox } from "@/components/States";
import type { PurificationResponse } from "@/app/api/purification/route";

function fmtAmount(n: number, currency: "usd" | "sar"): string {
  if (currency === "usd") return fmtDollar(n);
  return (
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: n > 0 && n < 1 ? 4 : 2,
    }) + " ر.س"
  );
}

function PeriodCard({
  label,
  usd,
  sar,
}: {
  label: string;
  usd: number;
  sar: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">
        {fmtAmount(usd, "usd")}
      </p>
      {sar > 0 ? (
        <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">
          {fmtAmount(sar, "sar")}
        </p>
      ) : null}
    </div>
  );
}

const VERDICT_CHIP: Record<string, { label: string; cls: string }> = {
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

export function PurificationClient() {
  const session = useSession();
  const [data, setData] = useState<PurificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!session.user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<PurificationResponse>("/api/purification")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "خطأ غير متوقع.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.user, refresh]);

  const retry = useCallback(() => setRefresh((n) => n + 1), []);

  if (session.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (!session.enabled || !session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {session.enabled ? "سجّل الدخول أولاً" : "الحسابات غير مفعّلة على هذا النشر"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            تقرير التطهير يُحسب من سجل صفقاتك المغلقة في حسابك.
          </p>
          {session.enabled ? (
            <Link href="/account" className="btn-primary mt-6 inline-block px-6 py-2">
              تسجيل الدخول
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          تطهير محفظتي
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          لكل صفقة مغلقة رابحة: مبلغ التطهير المستحق = الربح المحقق ×
          نسبة تطهير السهم (الدخل غير المباح ÷ الإيراد). تصدّق به ولا
          تنتفع به — فهو ليس من كسبك الطيب.
        </p>
      </header>

      {loading ? (
        <div className="card h-64 animate-pulse" />
      ) : error ? (
        <ErrorBox message={error} onRetry={retry} />
      ) : data ? (
        <>
          {/* الإجماليات */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PeriodCard label="هذا الشهر" usd={data.periods.thisMonth.usd} sar={data.periods.thisMonth.sar} />
            <PeriodCard label="هذه السنة" usd={data.periods.thisYear.usd} sar={data.periods.thisYear.sar} />
            <PeriodCard label="منذ البداية" usd={data.periods.allTime.usd} sar={data.periods.allTime.sar} />
          </div>

          {/* تنبيهات النواقص */}
          {data.totals.missingQty > 0 || data.totals.unknownRatio > 0 || data.totals.nonCompliant > 0 ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {data.totals.missingQty > 0 ? (
                <p>• {data.totals.missingQty} صفقة رابحة بلا كمية محددة — مبلغها الكلي غير محسوب (عدّل الصفقة وأضف الكمية).</p>
              ) : null}
              {data.totals.unknownRatio > 0 ? (
                <p>• {data.totals.unknownRatio} صفقة تعذّرت نسبة تطهير سهمها (بيانات مالية غير كافية).</p>
              ) : null}
              {data.totals.nonCompliant > 0 ? (
                <p>• {data.totals.nonCompliant} صفقة رابحة على سهم غير متوافق — بعض أهل العلم يرى التصدق بكامل ربحها.</p>
              ) : null}
            </div>
          ) : null}

          {/* الجدول */}
          {data.rows.length === 0 ? (
            <div className="card p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              لا صفقات مغلقة بعد — أغلق صفقات من{" "}
              <Link href="/trades" className="font-bold text-brand-700 hover:underline dark:text-brand-400">
                سجل صفقاتك
              </Link>{" "}
              وسيُحسب تطهيرها هنا تلقائياً.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <th className="p-2.5 text-start font-medium">الرمز</th>
                    <th className="p-2.5 text-end font-medium">الدخول</th>
                    <th className="p-2.5 text-end font-medium">الخروج</th>
                    <th className="p-2.5 text-end font-medium">الكمية</th>
                    <th className="p-2.5 text-end font-medium">الربح</th>
                    <th className="p-2.5 text-start font-medium">الحكم</th>
                    <th className="p-2.5 text-end font-medium">نسبة التطهير</th>
                    <th className="p-2.5 text-end font-medium">مبلغ التطهير</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const chip = VERDICT_CHIP[r.verdict] ?? VERDICT_CHIP.UNKNOWN;
                    return (
                      <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                        <td className="p-2.5">
                          <Link
                            href={`/stock/${r.ticker}`}
                            className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                            dir="ltr"
                          >
                            {r.ticker}
                          </Link>
                        </td>
                        <td className="p-2.5 text-end tabular-nums">{fmtPrice(r.entryPrice, r.currency)}</td>
                        <td className="p-2.5 text-end tabular-nums">{fmtPrice(r.exitPrice, r.currency)}</td>
                        <td className="p-2.5 text-end tabular-nums">{r.qty !== null ? fmtNum(r.qty, 0) : "—"}</td>
                        <td className={"p-2.5 text-end font-bold tabular-nums " + changeColorClass(r.profitPerShare)}>
                          <span dir="ltr">
                            {r.profit !== null
                              ? fmtPrice(r.profit, r.currency)
                              : `${fmtPrice(r.profitPerShare, r.currency)}/سهم`}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={"inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " + chip.cls}>
                            {chip.label}
                          </span>
                        </td>
                        <td className="p-2.5 text-end tabular-nums">
                          {r.purificationRatio !== null ? `${r.purificationRatio}%` : "—"}
                        </td>
                        <td className="p-2.5 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                          <span dir="ltr">
                            {r.amount !== null
                              ? fmtPrice(r.amount, r.currency)
                              : r.amountPerShare !== null && r.amountPerShare > 0
                                ? `${fmtPrice(r.amountPerShare, r.currency)}/سهم`
                                : r.amountPerShare === 0
                                  ? "—"
                                  : "؟"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* المنهجية */}
          <ul className="space-y-1">
            {data.notesAr.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {n}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
