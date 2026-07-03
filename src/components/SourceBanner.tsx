import { DataSource } from "@/lib/types";

/** شريط تنبيه عند العرض ببيانات تجريبية (source === "demo") */
export function SourceBanner({ source }: { source: DataSource }) {
  if (source !== "demo") return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
      بيانات تجريبية للعرض — تعذّر الوصول لمصدر البيانات الحي
    </div>
  );
}
