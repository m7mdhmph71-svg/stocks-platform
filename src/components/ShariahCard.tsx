import { ShariahResult, ShariahVerdict } from "@/lib/types";
import { fmtDateAr, fmtNum } from "@/lib/format";
import { fmtDollar } from "@/components/ui";

const VERDICT_BANNER: Record<
  ShariahVerdict,
  { cls: string; dot: string }
> = {
  COMPLIANT: {
    cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  MIXED: {
    cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  NON_COMPLIANT: {
    cls: "border-red-300 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200",
    dot: "bg-red-500",
  },
  UNKNOWN: {
    cls: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-200",
    dot: "bg-zinc-400",
  },
};

function RatioBar({
  labelAr,
  value,
  limit,
  pass,
  detailAr,
}: {
  labelAr: string;
  value: number | null;
  limit: number;
  pass: boolean | null;
  detailAr: string;
}) {
  const scale = Math.max(limit * 1.6, value ?? 0);
  const fillPct = value !== null ? Math.min(100, (value / scale) * 100) : 0;
  const limitPct = Math.min(100, (limit / scale) * 100);
  const fillColor =
    value === null
      ? "bg-zinc-400"
      : pass === false
        ? "bg-red-500"
        : "bg-emerald-500";

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          {labelAr}
        </span>
        {value !== null ? (
          <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
            <b
              className={
                pass === false
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {fmtNum(value, 2)}%
            </b>{" "}
            <span className="text-zinc-400 dark:text-zinc-500">
              / الحد {fmtNum(limit, 0)}%
            </span>
          </span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            بيانات غير متوفرة
          </span>
        )}
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full ${fillColor}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* علامة الحد الأقصى */}
        <div
          className="absolute inset-y-0 w-0.5 bg-zinc-500/80 dark:bg-zinc-300/70"
          style={{ insetInlineStart: `${limitPct}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {detailAr}
      </p>
    </div>
  );
}

export function ShariahCard({ shariah }: { shariah: ShariahResult | null }) {
  if (!shariah) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          الفحص الشرعي
        </h2>
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${VERDICT_BANNER.UNKNOWN.cls}`}
        >
          <span className={`h-3 w-3 rounded-full ${VERDICT_BANNER.UNKNOWN.dot}`} />
          <div>
            <p className="text-lg font-bold">غير معروف</p>
            <p className="text-sm opacity-80">
              لا تتوفر بيانات مالية كافية لإجراء الفحص الشرعي لهذا السهم.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const banner = VERDICT_BANNER[shariah.verdict];

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        الفحص الشرعي
      </h2>

      {/* الحكم */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${banner.cls}`}
      >
        <span className={`h-3 w-3 shrink-0 rounded-full ${banner.dot}`} />
        <p className="text-xl font-bold">{shariah.verdictAr}</p>
      </div>

      {/* فحص النشاط */}
      <div className="mt-4 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          نشاط الشركة:
        </span>
        {shariah.businessCompliant === true ? (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            مباح
          </span>
        ) : shariah.businessCompliant === false ? (
          <span className="font-bold text-red-600 dark:text-red-400">محرم</span>
        ) : (
          <span className="font-bold text-zinc-500 dark:text-zinc-400">
            غير معروف
          </span>
        )}
        {shariah.businessReasonAr ? (
          <span className="w-full text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {shariah.businessReasonAr}
          </span>
        ) : null}
      </div>

      {/* النسب المالية */}
      {shariah.ratios.length > 0 ? (
        <div className="mt-5 space-y-5">
          {shariah.ratios.map((r) => (
            <RatioBar
              key={r.key}
              labelAr={r.labelAr}
              value={r.value}
              limit={r.limit}
              pass={r.pass}
              detailAr={r.detailAr}
            />
          ))}
        </div>
      ) : null}

      {/* نسبة التطهير */}
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            نسبة التطهير
          </span>
          <span className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {shariah.purificationRatio !== null
              ? fmtNum(shariah.purificationRatio, 2) + "%"
              : "—"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80">
          {shariah.purificationPerShare !== null
            ? `ما يعادل تقديرياً ${fmtDollar(
                shariah.purificationPerShare
              )} لكل سهم سنوياً.`
            : "لا يتوفر تقدير لنصيب السهم من الدخل غير المباح."}
        </p>
      </div>

      {/* المنهجية */}
      <details className="group mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60">
          <span className="text-xs text-zinc-400 transition-transform group-open:rotate-90">
            ◀
          </span>
          منهجية الفحص
        </summary>
        <p className="border-t border-zinc-100 px-3.5 py-3 text-xs leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {shariah.methodologyAr}
        </p>
      </details>

      <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
        آخر بيانات مالية مستخدمة: {fmtDateAr(shariah.asOf)}
      </p>
    </section>
  );
}
