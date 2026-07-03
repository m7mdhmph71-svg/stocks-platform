"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StockRow } from "@/lib/types";
import {
  changeColorClass,
  fmtCompact,
  fmtNum,
  fmtPercent,
  fmtPrice,
} from "@/lib/format";
import { ShariahBadge } from "@/components/ShariahBadge";

type SortKey =
  | "ticker"
  | "name"
  | "price"
  | "changePercent"
  | "changeFromOpenPercent"
  | "volume"
  | "relativeVolume"
  | "floatShares"
  | "shariah"
  | "target1"
  | "score";

interface Column {
  key: SortKey;
  label: string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  { key: "ticker", label: "الرمز", numeric: false },
  { key: "name", label: "الاسم", numeric: false },
  { key: "price", label: "السعر", numeric: true },
  { key: "changePercent", label: "تغير اليوم", numeric: true },
  { key: "changeFromOpenPercent", label: "من الافتتاح", numeric: true },
  { key: "volume", label: "الحجم", numeric: true },
  { key: "relativeVolume", label: "الحجم النسبي", numeric: true },
  { key: "floatShares", label: "الأسهم الحرة", numeric: true },
  { key: "shariah", label: "الشرعية", numeric: false },
  { key: "target1", label: "الهدف الأول", numeric: true },
  { key: "score", label: "الدرجة", numeric: true },
];

const VERDICT_RANK: Record<string, number> = {
  COMPLIANT: 3,
  MIXED: 2,
  NON_COMPLIANT: 1,
  UNKNOWN: 0,
};

function sortValue(row: StockRow, key: SortKey): number | string | null {
  switch (key) {
    case "ticker":
      return row.ticker;
    case "name":
      return row.name;
    case "price":
      return row.price;
    case "changePercent":
      return row.changePercent;
    case "changeFromOpenPercent":
      return row.changeFromOpenPercent;
    case "volume":
      return row.volume;
    case "relativeVolume":
      return row.relativeVolume;
    case "floatShares":
      return row.floatShares;
    case "shariah":
      return row.shariah ? VERDICT_RANK[row.shariah.verdict] ?? 0 : null;
    case "target1":
      return row.targets?.targets[0]?.price ?? null;
    case "score":
      return row.targets?.score ?? null;
  }
}

function MiniScore({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined || !isFinite(score)) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  const v = Math.max(0, Math.min(100, score));
  const color =
    v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-xs font-medium tabular-nums">{Math.round(v)}</span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <span
          className={`block h-full rounded-full ${color}`}
          style={{ width: `${v}%` }}
        />
      </span>
    </span>
  );
}

export function StockTable({ rows }: { rows: StockRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // القيم المفقودة دائماً في الآخر
      if (vb === null) return -1;
      let cmp: number;
      if (typeof va === "string" || typeof vb === "string") {
        cmp = String(va).localeCompare(String(vb));
      } else {
        cmp = va - vb;
      }
      return asc ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active ? (asc ? "ascending" : "descending") : "none"
                    }
                    className={`px-3 py-2.5 font-medium ${
                      col.numeric ? "text-end" : "text-start"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
                        active ? "text-brand-600 dark:text-brand-400" : ""
                      }`}
                    >
                      {col.label}
                      <span className="text-[10px]" aria-hidden>
                        {active ? (asc ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((row) => (
              <tr
                key={row.ticker}
                className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <td className="px-3 py-3">
                  <Link
                    href={`/stock/${encodeURIComponent(row.ticker)}`}
                    dir="ltr"
                    className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                  >
                    {row.ticker}
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-3 py-3 text-zinc-700 dark:text-zinc-300">
                  {row.name}
                </td>
                <td className="px-3 py-3 text-end font-medium tabular-nums">
                  {fmtPrice(row.price)}
                </td>
                <td
                  className={`px-3 py-3 text-end tabular-nums ${changeColorClass(
                    row.changePercent
                  )}`}
                >
                  {fmtPercent(row.changePercent)}
                </td>
                <td
                  className={`px-3 py-3 text-end tabular-nums ${changeColorClass(
                    row.changeFromOpenPercent
                  )}`}
                >
                  {fmtPercent(row.changeFromOpenPercent)}
                </td>
                <td className="px-3 py-3 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                  {fmtCompact(row.volume)}
                </td>
                <td className="px-3 py-3 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                  {row.relativeVolume !== null
                    ? fmtNum(row.relativeVolume, 2) + "×"
                    : "—"}
                </td>
                <td className="px-3 py-3 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                  {fmtCompact(row.floatShares)}
                </td>
                <td className="px-3 py-3">
                  <ShariahBadge shariah={row.shariah} />
                </td>
                <td className="px-3 py-3 text-end tabular-nums text-zinc-700 dark:text-zinc-200">
                  {row.targets?.targets[0]
                    ? fmtPrice(row.targets.targets[0].price)
                    : "—"}
                </td>
                <td className="px-3 py-3 text-end">
                  <MiniScore score={row.targets?.score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
