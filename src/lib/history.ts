// سجل نتائج الفلاتر السابقة — يُحفظ محلياً على جهاز المستخدم (localStorage).
// كل فتح ناجح لفلتر يسجّل «لقطة» بأهم بيانات النتائج ليُقارن لاحقاً
// سعرُ كل سهم حين ظهوره في الفلتر بسعره الحالي.
//
// يعمل في المتصفح فقط — كل الدوال آمنة عند الاستدعاء من الخادم (تعيد فراغاً).

import { ScreenerResponse, ShariahVerdict } from "@/lib/types";

export interface SnapshotRow {
  ticker: string;
  name: string;
  price: number;
  changePercent: number | null;
  verdict: ShariahVerdict | null;
  purificationRatio: number | null;
}

export interface Snapshot {
  id: string;
  /** يوم اللقطة بتوقيت جهاز المستخدم YYYY-MM-DD */
  dateKey: string;
  /** وقت الحفظ ISO */
  savedAt: string;
  preset: string;
  presetNameAr: string;
  total: number;
  rows: SnapshotRow[];
}

const KEY = "sahm:filterHistory:v1";
/** أقصى عدد لقطات محفوظة (الأقدم يُحذف) */
const MAX_SNAPSHOTS = 60;
/** أقصى عدد أسهم تُحفظ من كل لقطة */
const MAX_ROWS = 30;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function loadSnapshots(): Snapshot[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Snapshot =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as Snapshot).id === "string" &&
        typeof (s as Snapshot).dateKey === "string" &&
        Array.isArray((s as Snapshot).rows)
    );
  } catch {
    return [];
  }
}

function persist(snapshots: Snapshot[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshots));
  } catch {
    // امتلاء التخزين — احذف النصف الأقدم وحاول مرة أخيرة
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify(snapshots.slice(0, Math.ceil(snapshots.length / 2)))
      );
    } catch {
      /* تجاهل */
    }
  }
}

/**
 * يحفظ لقطة من استجابة الفرز. لقطة واحدة لكل (فلتر، يوم) — الأحدث تحل
 * محل السابقة في اليوم نفسه. البيانات التجريبية لا تُسجَّل.
 */
export function saveSnapshot(
  preset: string,
  presetNameAr: string,
  resp: ScreenerResponse
): void {
  if (!hasStorage()) return;
  if (resp.source === "demo" || resp.rows.length === 0) return;

  const dateKey = todayKey();
  const snapshot: Snapshot = {
    id: `${preset}:${dateKey}`,
    dateKey,
    savedAt: new Date().toISOString(),
    preset,
    presetNameAr,
    total: resp.total,
    rows: resp.rows.slice(0, MAX_ROWS).map((r) => ({
      ticker: r.ticker,
      name: r.name,
      price: r.price,
      changePercent: r.changePercent,
      verdict: r.shariah?.verdict ?? null,
      purificationRatio: r.shariah?.purificationRatio ?? null,
    })),
  };

  const rest = loadSnapshots().filter((s) => s.id !== snapshot.id);
  // الأحدث أولاً، مع سقف للعدد الكلي
  persist([snapshot, ...rest].slice(0, MAX_SNAPSHOTS));
}

export function deleteSnapshot(id: string): void {
  persist(loadSnapshots().filter((s) => s.id !== id));
}

export function clearSnapshots(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* تجاهل */
  }
}
