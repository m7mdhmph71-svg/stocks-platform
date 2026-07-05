"use client";

// قائمة المتابعة: أسهمك مع السعر والحكم الشرعي — وتنبيه بارز إن تغيّر الحكم

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShariahResult } from "@/lib/types";
import { useSession } from "@/components/useSession";
import { ShariahBadge } from "@/components/ShariahBadge";
import { fetchJson } from "@/components/ui";
import { currencyFor, fmtPrice, fmtPercent, changeColorClass } from "@/lib/format";
import { EmptyState, ErrorBox } from "@/components/States";
import { TableSkeleton } from "@/components/Skeletons";

interface WatchRow {
  ticker: string;
  name: string;
  addedAt: string;
  price: number | null;
  changePercent: number | null;
  shariah: ShariahResult;
  verdictChanged: boolean;
  previousVerdict: string | null;
}

export function WatchlistClient() {
  const session = useSession();
  const [rows, setRows] = useState<WatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (session.loading || !session.user) return;
    let cancelled = false;
    setError(null);
    fetchJson<{ rows: WatchRow[] }>("/api/watchlist")
      .then((d) => {
        if (!cancelled) setRows(d.rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطأ.");
      });
    return () => {
      cancelled = true;
    };
  }, [session.loading, session.user, tick]);

  const remove = useCallback(async (ticker: string) => {
    await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, {
      method: "DELETE",
    });
    setTick((n) => n + 1);
  }, []);

  if (session.loading) return <div className="mx-auto max-w-5xl px-4 py-8"><TableSkeleton /></div>;

  if (!session.enabled || !session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            قائمة المتابعة تتطلب حساباً
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            {session.enabled
              ? "سجّل الدخول لتتابع أسهمك ويُراقب حكمها الشرعي تلقائياً."
              : "الحسابات غير مفعّلة على هذا النشر التجريبي."}
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

  const changed = rows?.filter((r) => r.verdictChanged) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          قائمة المتابعة
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          يُعاد فحص الحكم الشرعي لأسهمك مع كل زيارة — وإن تغيّر منذ آخر مرة
          فسننبهك هنا فوراً.
        </p>
      </div>

      {changed.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
          ⚠️ <b>تغيّر الحكم الشرعي</b> منذ آخر فحص لـ:{" "}
          {changed.map((r) => r.ticker).join("، ")} — راجع التفاصيل قبل أي
          قرار.
        </div>
      ) : null}

      {error ? (
        <ErrorBox message={error} onRetry={() => setTick((n) => n + 1)} />
      ) : rows === null ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          message="قائمتك فارغة."
          hint="افتح صفحة أي سهم واضغط «تابِع» لإضافته، أو ابحث عن سهم من الشريط العلوي."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="p-3 text-start font-medium">الرمز</th>
                <th className="p-3 text-start font-medium">الاسم</th>
                <th className="p-3 text-end font-medium">السعر</th>
                <th className="p-3 text-end font-medium">التغير</th>
                <th className="p-3 text-start font-medium">الشرعية</th>
                <th className="p-3 text-start font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  className={
                    "border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 " +
                    (r.verdictChanged ? "bg-amber-50/60 dark:bg-amber-950/20" : "")
                  }
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
                  <td className="max-w-[14rem] truncate p-3 text-zinc-600 dark:text-zinc-300">
                    {r.name}
                  </td>
                  <td className="p-3 text-end tabular-nums text-zinc-900 dark:text-zinc-50">
                    {fmtPrice(r.price, currencyFor(r.ticker))}
                  </td>
                  <td className={"p-3 text-end font-bold tabular-nums " + changeColorClass(r.changePercent)}>
                    <span dir="ltr">{fmtPercent(r.changePercent)}</span>
                  </td>
                  <td className="p-3">
                    <ShariahBadge shariah={r.shariah} />
                    {r.verdictChanged ? (
                      <span className="ms-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        (تغيّر!)
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-end">
                    <button
                      type="button"
                      onClick={() => remove(r.ticker)}
                      className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      إزالة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
