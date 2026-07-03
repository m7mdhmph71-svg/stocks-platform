import Link from "next/link";
import { ScreenerPreset } from "@/lib/types";

/** بطاقة استراتيجية في الصفحة الرئيسية */
export function StrategyCard({ preset }: { preset: ScreenerPreset }) {
  const chips = preset.legend.slice(0, 5);
  const more = preset.legend.length - chips.length;

  return (
    <div className="card group flex flex-col p-6 transition-shadow hover:shadow-md">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {preset.nameAr}
        </h3>
      </div>
      <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
        {preset.taglineAr}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {preset.descriptionAr}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c.code} className="chip">
            {c.meaningAr}
          </span>
        ))}
        {more > 0 ? <span className="chip">+{more} شروط أخرى</span> : null}
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={`/screener?preset=${preset.key}`}
          className="btn-primary w-full"
        >
          افتح الفلتر
          <span aria-hidden className="text-xs">
            ←
          </span>
        </Link>
      </div>
    </div>
  );
}
