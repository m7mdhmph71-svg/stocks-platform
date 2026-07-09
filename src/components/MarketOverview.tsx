"use client";

// شريط نبض السوق في الرئيسية: المؤشرات الرئيسة + حالة الجلستين —
// أول ما يراه الزائر حياً بدل صفحة ساكنة.

import { useEffect, useState } from "react";
import { fetchJson } from "@/components/ui";
import { fmtNum, fmtPercent, changeColorClass } from "@/lib/format";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import type { MarketOverviewResponse } from "@/app/api/market-overview/route";

export function MarketOverview() {
  const [data, setData] = useState<MarketOverviewResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchJson<MarketOverviewResponse>("/api/market-overview")
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch(() => {
          /* الشريط تحسين — غيابه لا يكسر الصفحة */
        });
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="border-b border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <MarketStatusBadge market="us" />
          <MarketStatusBadge market="sa" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {(data?.indices ?? []).map((idx) =>
            idx.price !== null ? (
              <span
                key={idx.symbol}
                className="inline-flex items-baseline gap-2 text-sm"
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {idx.nameAr}
                </span>
                <span
                  className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50"
                  dir="ltr"
                >
                  {fmtNum(idx.price, 0)}
                </span>
                <span
                  className={
                    "text-xs font-medium tabular-nums " +
                    changeColorClass(idx.changePercent)
                  }
                  dir="ltr"
                >
                  {fmtPercent(idx.changePercent)}
                </span>
              </span>
            ) : null
          )}
        </div>
      </div>
    </section>
  );
}
