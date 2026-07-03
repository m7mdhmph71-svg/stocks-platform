import { ScreenerPreset } from "@/lib/types";

/** لوحة قابلة للطي تعرض رموز Finviz الأصلية ومعانيها — للمصداقية والشفافية */
export function LegendPanel({ preset }: { preset: ScreenerPreset }) {
  return (
    <details className="card group p-0">
      <summary className="flex cursor-pointer select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60">
        <span className="text-xs text-zinc-400 transition-transform group-open:rotate-90">
          ◀
        </span>
        شرح رموز الفلتر الأصلية (Finviz)
        <span className="chip ms-auto hidden sm:inline-flex">
          {preset.legend.length} رمزاً
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          سلسلة الفلتر الأصلية:{" "}
          <code
            dir="ltr"
            className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {preset.finvizQuery}
          </code>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  رمز الفلتر
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  المعنى
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {preset.legend.map((item) => (
                <tr key={item.code}>
                  <td className="py-2 pe-4">
                    <code
                      dir="ltr"
                      className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 dark:bg-zinc-800 dark:text-brand-400"
                    >
                      {item.code}
                    </code>
                  </td>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">
                    {item.meaningAr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
