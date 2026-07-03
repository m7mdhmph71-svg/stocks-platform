import { ShariahResult } from "@/lib/types";
import { fmtNum } from "@/lib/format";

/** شارة الحكم الشرعي: نقطة ملوّنة + نص مختصر */
export function ShariahBadge({
  shariah,
  size = "sm",
}: {
  shariah: ShariahResult | null;
  size?: "sm" | "lg";
}) {
  const verdict = shariah?.verdict ?? "UNKNOWN";

  let cls =
    "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  let dot = "bg-zinc-400";
  let label = "غير معروف";

  if (verdict === "COMPLIANT") {
    cls =
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-300";
    dot = "bg-emerald-500";
    label = "متوافق";
  } else if (verdict === "MIXED") {
    cls =
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-300";
    dot = "bg-amber-500";
    const ratio = shariah?.purificationRatio;
    label =
      ratio !== null && ratio !== undefined
        ? `مختلط · تطهير ${fmtNum(ratio, 2)}%`
        : "مختلط";
  } else if (verdict === "NON_COMPLIANT") {
    cls =
      "border-red-300 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300";
    dot = "bg-red-500";
    label = "غير متوافق";
  }

  const sizeCls =
    size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${sizeCls} ${cls}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
