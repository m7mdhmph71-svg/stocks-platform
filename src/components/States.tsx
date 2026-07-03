"use client";

/** حالتا الخطأ والفراغ بأسلوب موحّد */

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center gap-4 border-red-200 p-8 text-center dark:border-red-900/60"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600 dark:bg-red-950/60 dark:text-red-400">
        !
      </span>
      <div>
        <p className="font-semibold text-red-700 dark:text-red-300">
          حدث خطأ أثناء جلب البيانات
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-primary">
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  message = "لا نتائج تطابق الشروط الآن.",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        ∅
      </span>
      <p className="font-medium text-zinc-700 dark:text-zinc-200">{message}</p>
      {hint ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
