import { TechnicalSnapshot } from "@/lib/types";
import { fmtNum, fmtPercent, fmtPrice } from "@/lib/format";

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

/** جدول مؤشرات فنية مختصر */
export function TechnicalsTable({
  indicators,
  currency = "$",
}: {
  indicators: TechnicalSnapshot;
  /** عملة العرض (افتراضياً دولار) */
  currency?: string;
}) {
  const t = indicators;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        المؤشرات الفنية
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cell label="RSI (14)" value={fmtNum(t.rsi14, 1)} />
        <Cell label="ATR (14)" value={fmtPrice(t.atr14, currency)} />
        <Cell label="أداء الأسبوع" value={fmtPercent(t.weekPerfPercent)} />
        <Cell label="المتوسط 20 يوم" value={fmtPrice(t.sma20, currency)} />
        <Cell label="المتوسط 50 يوم" value={fmtPrice(t.sma50, currency)} />
        <Cell label="المتوسط 200 يوم" value={fmtPrice(t.sma200, currency)} />
        <Cell label="قمة 50 يوماً" value={fmtPrice(t.high50d, currency)} />
        <Cell label="قاع 50 يوماً" value={fmtPrice(t.low50d, currency)} />
        <Cell label="أداء الشهر" value={fmtPercent(t.monthPerfPercent)} />
        <Cell label="قمة 52 أسبوعاً" value={fmtPrice(t.high52w, currency)} />
        <Cell label="قاع 52 أسبوعاً" value={fmtPrice(t.low52w, currency)} />
        <Cell
          label="نقطة الارتكاز (Pivot)"
          value={t.pivot ? fmtPrice(t.pivot.p) : "—"}
        />
      </div>
    </section>
  );
}
