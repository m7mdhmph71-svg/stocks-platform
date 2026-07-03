"use client";

import { useState } from "react";
import { FilterCondition, FilterField, FilterOp } from "@/lib/types";

const FIELD_LABELS: Record<FilterField, string> = {
  price: "السعر ($)",
  volume: "حجم التداول",
  avgVolume3m: "متوسط الحجم (3 أشهر)",
  relativeVolume: "الحجم النسبي",
  floatShares: "الأسهم الحرة",
  marketCap: "القيمة السوقية ($)",
  changePercent: "تغير اليوم %",
  changeFromOpenPercent: "التغير من الافتتاح %",
  weekPerfPercent: "أداء الأسبوع %",
};

const OP_LABELS: Record<FilterOp, string> = {
  gt: "أكبر من",
  gte: "أكبر من أو يساوي",
  lt: "أصغر من",
  lte: "أصغر من أو يساوي",
  btwn: "بين",
};

const FIELDS = Object.keys(FIELD_LABELS) as FilterField[];
const OPS = Object.keys(OP_LABELS) as FilterOp[];

interface DraftRow {
  id: number;
  field: FilterField;
  op: FilterOp;
  v1: string;
  v2: string;
}

let nextId = 1;

function fromConditions(conds: FilterCondition[]): DraftRow[] {
  return conds.map((c) => ({
    id: nextId++,
    field: c.field,
    op: c.op,
    v1: String(Array.isArray(c.value) ? c.value[0] : c.value),
    v2: Array.isArray(c.value) ? String(c.value[1]) : "",
  }));
}

export function FilterBuilder({
  initial,
  onApply,
}: {
  initial: FilterCondition[];
  onApply: (conds: FilterCondition[]) => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    initial.length > 0
      ? fromConditions(initial)
      : [{ id: nextId++, field: "price", op: "gt", v1: "", v2: "" }]
  );

  function update(id: number, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { id: nextId++, field: "volume", op: "gt", v1: "", v2: "" },
    ]);
  }

  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function apply() {
    const conds: FilterCondition[] = [];
    for (const r of rows) {
      const n1 = Number(r.v1);
      if (r.v1.trim() === "" || !isFinite(n1)) continue;
      if (r.op === "btwn") {
        const n2 = Number(r.v2);
        if (r.v2.trim() === "" || !isFinite(n2)) continue;
        conds.push({
          field: r.field,
          op: "btwn",
          value: [Math.min(n1, n2), Math.max(n1, n2)],
        });
      } else {
        conds.push({ field: r.field, op: r.op, value: n1 });
      }
    }
    onApply(conds);
  }

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="mb-1 font-bold text-zinc-900 dark:text-zinc-50">
        منشئ الفلتر المخصص
      </h3>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        أضف شرطاً أو أكثر ثم اضغط «تطبيق الفلتر». الأسهم التي تنقصها بيانات
        الحقل لا تجتاز الشرط.
      </p>

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
          >
            <select
              value={r.field}
              onChange={(e) =>
                update(r.id, { field: e.target.value as FilterField })
              }
              className="field w-44 flex-none"
              aria-label="الحقل"
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f]}
                </option>
              ))}
            </select>

            <select
              value={r.op}
              onChange={(e) => update(r.id, { op: e.target.value as FilterOp })}
              className="field w-40 flex-none"
              aria-label="المعامل"
            >
              {OPS.map((op) => (
                <option key={op} value={op}>
                  {OP_LABELS[op]}
                </option>
              ))}
            </select>

            <input
              type="number"
              inputMode="decimal"
              value={r.v1}
              onChange={(e) => update(r.id, { v1: e.target.value })}
              placeholder={r.op === "btwn" ? "الحد الأدنى" : "القيمة"}
              className="field w-32 flex-none tabular-nums"
              dir="ltr"
              aria-label="القيمة"
            />

            {r.op === "btwn" ? (
              <>
                <span className="text-sm text-zinc-400">و</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={r.v2}
                  onChange={(e) => update(r.id, { v2: e.target.value })}
                  placeholder="الحد الأعلى"
                  className="field w-32 flex-none tabular-nums"
                  dir="ltr"
                  aria-label="الحد الأعلى"
                />
              </>
            ) : null}

            <button
              type="button"
              onClick={() => removeRow(r.id)}
              className="ms-auto rounded-lg px-2 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
              aria-label="حذف الشرط"
            >
              حذف
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className="btn-ghost">
          + إضافة شرط
        </button>
        <button type="button" onClick={apply} className="btn-primary">
          تطبيق الفلتر
        </button>
      </div>
    </div>
  );
}
