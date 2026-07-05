"use client";

// سجل صفقاتي: الصفقات المفتوحة بمتابعة حية ضد الهدف/الوقف + أرشيف المغلقة

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { fetchJson, fmtDateTimeAr } from "@/components/ui";
import { currencyFor, fmtPrice, fmtPercent, changeColorClass } from "@/lib/format";
import { EmptyState, ErrorBox } from "@/components/States";
import { TableSkeleton } from "@/components/Skeletons";

interface TradeRow {
  id: string;
  ticker: string;
  strategy: string;
  entryPrice: number;
  target: number;
  stop: number;
  qty: number | null;
  status: "OPEN" | "TARGET" | "STOP" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  exitPrice: number | null;
  notes: string | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  hint: "AT_TARGET" | "AT_STOP" | null;
}

const STATUS_CHIP: Record<TradeRow["status"], { label: string; cls: string }> = {
  OPEN: { label: "مفتوحة", cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" },
  TARGET: { label: "هدف ✓", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  STOP: { label: "وقف ✗", cls: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
  CLOSED: { label: "أُغلقت يدوياً", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
};

const STRATEGY_AR: Record<string, string> = {
  liquidity: "صيد السيولة",
  momentum: "الزخم/السوينق",
  longterm: "استثمار",
  custom: "مخصص",
};

/** موضع السعر الحالي بين الوقف والهدف (0..100) لشريط التقدم */
function progress(t: TradeRow): number | null {
  if (t.currentPrice === null) return null;
  const span = t.target - t.stop;
  if (!(span > 0)) return null;
  return Math.max(0, Math.min(100, ((t.currentPrice - t.stop) / span) * 100));
}

export function TradesClient() {
  const session = useSession();
  const [rows, setRows] = useState<TradeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (session.loading || !session.user) return;
    let cancelled = false;
    setError(null);
    fetchJson<{ rows: TradeRow[] }>("/api/trades")
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

  const act = useCallback(async (id: string, action: string) => {
    await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setTick((n) => n + 1);
  }, []);

  const open = useMemo(() => rows?.filter((r) => r.status === "OPEN") ?? [], [rows]);
  const closed = useMemo(() => rows?.filter((r) => r.status !== "OPEN") ?? [], [rows]);

  if (session.loading) return <div className="mx-auto max-w-5xl px-4 py-8"><TableSkeleton /></div>;

  if (!session.enabled || !session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            سجل الصفقات يتطلب حساباً
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            {session.enabled
              ? "سجّل الدخول لتوثّق صفقاتك وتتابعها ضد أهدافها وأوقافها."
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          سجل صفقاتي
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          افتح الصفقة من صفحة السهم بزر «دخلت الصفقة» فتُتابع هنا ضد هدفها
          ووقفها — التوثيق يصنع الانضباط.
        </p>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={() => setTick((n) => n + 1)} />
      ) : rows === null ? (
        <TableSkeleton />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
              المفتوحة ({open.length})
            </h2>
            {open.length === 0 ? (
              <EmptyState message="لا صفقات مفتوحة." />
            ) : (
              open.map((t) => {
                const p = progress(t);
                return (
                  <div key={t.id} className="card p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Link
                        href={`/stock/${t.ticker}`}
                        className="text-lg font-bold text-brand-700 hover:underline dark:text-brand-400"
                        dir="ltr"
                      >
                        {t.ticker}
                      </Link>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {STRATEGY_AR[t.strategy] ?? t.strategy} · {fmtDateTimeAr(t.openedAt)}
                      </span>
                      {t.hint === "AT_TARGET" ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          🎯 السعر بلغ الهدف!
                        </span>
                      ) : t.hint === "AT_STOP" ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 dark:bg-red-900 dark:text-red-200">
                          🛑 السعر عند الوقف!
                        </span>
                      ) : null}
                      <span
                        className={
                          "ms-auto text-lg font-bold tabular-nums " +
                          changeColorClass(t.pnlPercent)
                        }
                        dir="ltr"
                      >
                        {fmtPercent(t.pnlPercent)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">الدخول</span>
                        <span className="font-bold tabular-nums">{fmtPrice(t.entryPrice, currencyFor(t.ticker))}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">الآن</span>
                        <span className="font-bold tabular-nums">{fmtPrice(t.currentPrice, currencyFor(t.ticker))}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-emerald-600 dark:text-emerald-400">الهدف</span>
                        <span className="font-bold tabular-nums">{fmtPrice(t.target, currencyFor(t.ticker))}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-red-600 dark:text-red-400">الوقف</span>
                        <span className="font-bold tabular-nums">{fmtPrice(t.stop, currencyFor(t.ticker))}</span>
                      </div>
                    </div>

                    {p !== null ? (
                      <div className="mt-3" dir="ltr">
                        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-red-200 via-zinc-200 to-emerald-200 dark:from-red-900/60 dark:via-zinc-700 dark:to-emerald-900/60">
                          <span
                            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-800 shadow dark:border-zinc-900 dark:bg-zinc-100"
                            style={{ left: `${p}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act(t.id, "target")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        خرجت عند الهدف
                      </button>
                      <button
                        type="button"
                        onClick={() => act(t.id, "stop")}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                      >
                        ضُرب الوقف
                      </button>
                      <button
                        type="button"
                        onClick={() => act(t.id, "close")}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        إغلاق بالسعر الحالي
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
              المغلقة ({closed.length})
            </h2>
            {closed.length === 0 ? (
              <EmptyState message="لا صفقات مغلقة بعد." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="p-3 text-start font-medium">الرمز</th>
                      <th className="p-3 text-end font-medium">الدخول</th>
                      <th className="p-3 text-end font-medium">الخروج</th>
                      <th className="p-3 text-start font-medium">النتيجة</th>
                      <th className="p-3 text-end font-medium">العائد</th>
                      <th className="p-3 text-end font-medium">أُغلقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.map((t) => {
                      const chip = STATUS_CHIP[t.status];
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                        >
                          <td className="p-3">
                            <Link
                              href={`/stock/${t.ticker}`}
                              className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                              dir="ltr"
                            >
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="p-3 text-end tabular-nums">{fmtPrice(t.entryPrice, currencyFor(t.ticker))}</td>
                          <td className="p-3 text-end tabular-nums">{fmtPrice(t.exitPrice, currencyFor(t.ticker))}</td>
                          <td className="p-3">
                            <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + chip.cls}>
                              {chip.label}
                            </span>
                          </td>
                          <td className={"p-3 text-end font-bold tabular-nums " + changeColorClass(t.pnlPercent)}>
                            <span dir="ltr">{fmtPercent(t.pnlPercent)}</span>
                          </td>
                          <td className="p-3 text-end text-xs text-zinc-500 dark:text-zinc-400">
                            {t.closedAt ? fmtDateTimeAr(t.closedAt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
