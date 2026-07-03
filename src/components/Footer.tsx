export function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
              س
            </span>
            <span className="font-bold text-zinc-900 dark:text-zinc-50">
              سهم سكرينر
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            المنصة أداة فرز آلية للأغراض التعليمية؛ ليست توصية استثمارية، والفحص
            الشرعي تقديري اجتهادي مبني على القوائم المالية المتاحة ولا يغني عن
            الرجوع للهيئات الشرعية المعتمدة.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-1 border-t border-zinc-100 pt-4 text-xs text-zinc-400 sm:flex-row sm:justify-between dark:border-zinc-900 dark:text-zinc-500">
          <span>البيانات من مصادر عامة وقد تتأخر عن السوق المباشر.</span>
          <span>سهم سكرينر — منصة الفرز الشرعي والفني</span>
        </div>
      </div>
    </footer>
  );
}
