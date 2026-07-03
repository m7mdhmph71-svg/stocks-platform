// ============================================================
// محرك تقييم شروط الفلترة على صفوف الأسهم — دوال نقية بلا أي جلب بيانات.
// القاعدة: null في الحقل = لا يجتاز الشرط. btwn شاملة الطرفين.
// ============================================================

import { FilterCondition, FilterField, FilterOp, StockRow } from "@/lib/types";

const VALID_FIELDS: readonly FilterField[] = [
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

const VALID_OPS: readonly FilterOp[] = ["gt", "lt", "gte", "lte", "btwn"];

/** تقييم شرط واحد على صف. الحقل الغائب (null/غير منتهٍ) لا يجتاز أبداً. */
export function evalCondition(row: StockRow, cond: FilterCondition): boolean {
  const v = row[cond.field];
  if (v === null || v === undefined || !Number.isFinite(v)) return false;

  if (cond.op === "btwn") {
    if (!Array.isArray(cond.value)) return false;
    const [a, b] = cond.value;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    // شاملة الطرفين
    return v >= lo && v <= hi;
  }

  if (Array.isArray(cond.value)) return false;
  const x = cond.value;
  if (!Number.isFinite(x)) return false;

  switch (cond.op) {
    case "gt":
      return v > x;
    case "gte":
      return v >= x;
    case "lt":
      return v < x;
    case "lte":
      return v <= x;
    default:
      return false;
  }
}

/** إبقاء الصفوف التي تجتاز كل الشروط (AND) */
export function applyConditions(
  rows: StockRow[],
  conds: FilterCondition[]
): StockRow[] {
  if (conds.length === 0) return rows;
  return rows.filter((row) => conds.every((c) => evalCondition(row, c)));
}

/**
 * تحقّق من JSON قادم من العميل وأعد شروطاً سليمة فقط.
 * يتجاهل المدخلات غير الصالحة بهدوء (لا رمي أخطاء).
 * يطبّع نطاق btwn بحيث يكون [الأدنى, الأعلى] دائماً.
 */
export function parseConditions(raw: unknown): FilterCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: FilterCondition[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const field = o["field"];
    const op = o["op"];
    const value = o["value"];

    if (
      typeof field !== "string" ||
      !(VALID_FIELDS as readonly string[]).includes(field)
    ) {
      continue;
    }
    if (
      typeof op !== "string" ||
      !(VALID_OPS as readonly string[]).includes(op)
    ) {
      continue;
    }

    if (op === "btwn") {
      if (!Array.isArray(value) || value.length !== 2) continue;
      const a = value[0];
      const b = value[1];
      if (
        typeof a !== "number" ||
        typeof b !== "number" ||
        !Number.isFinite(a) ||
        !Number.isFinite(b)
      ) {
        continue;
      }
      out.push({
        field: field as FilterField,
        op: "btwn",
        value: [Math.min(a, b), Math.max(a, b)],
      });
    } else {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      out.push({
        field: field as FilterField,
        op: op as Exclude<FilterOp, "btwn">,
        value,
      });
    }
  }

  return out;
}
