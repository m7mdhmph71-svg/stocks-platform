import Link from "next/link";

/** بطاقة استراتيجية في الصفحة الرئيسية — شكل عام يخدم كل الاستراتيجيات */
export function StrategyCard({
  href,
  nameAr,
  taglineAr,
  descriptionAr,
  chips,
  highlight = false,
}: {
  href: string;
  nameAr: string;
  taglineAr: string;
  descriptionAr: string;
  chips: string[];
  /** تمييز الاستراتيجية المرشحة (الاتجاه الصاعد) */
  highlight?: boolean;
}) {
  const shown = chips.slice(0, 4);
  const more = chips.length - shown.length;

  return (
    <div
      className={
        "card group flex flex-col p-6 transition-shadow hover:shadow-md " +
        (highlight ? "border-brand-300 dark:border-brand-700" : "")
      }
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={
            "h-2.5 w-2.5 rounded-full " +
            (highlight ? "bg-brand-500" : "bg-zinc-400 dark:bg-zinc-500")
          }
        />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {nameAr}
        </h3>
        {highlight ? (
          <span className="chip border-brand-200 bg-brand-50 text-[11px] text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
            المُرشَّحة
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
        {taglineAr}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {descriptionAr}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {shown.map((c) => (
          <span key={c} className="chip">
            {c}
          </span>
        ))}
        {more > 0 ? <span className="chip">+{more} شروط أخرى</span> : null}
      </div>

      <div className="mt-auto pt-5">
        <Link href={href} className="btn-primary w-full">
          افتح الفلتر
          <span aria-hidden className="text-xs">
            ←
          </span>
        </Link>
      </div>
    </div>
  );
}
