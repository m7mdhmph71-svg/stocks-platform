/** هياكل تحميل (skeleton) موحّدة */

function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 " + className
      }
    />
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
        <Bar className="h-4 w-48" />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Bar className="h-4 w-14" />
            <Bar className="h-4 w-36" />
            <Bar className="h-4 w-16" />
            <Bar className="hidden h-4 w-16 sm:block" />
            <Bar className="hidden h-4 w-20 md:block" />
            <Bar className="ms-auto h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Bar className="h-7 w-32" />
            <Bar className="h-4 w-56" />
          </div>
          <div className="space-y-2">
            <Bar className="h-8 w-28" />
            <Bar className="h-4 w-20" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <Bar className="h-12 w-full rounded-xl" />
          <Bar className="h-4 w-3/4" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-2/3" />
        </div>
        <div className="card space-y-4 p-6">
          <Bar className="h-8 w-64 rounded-xl" />
          <Bar className="h-4 w-1/2" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-2/3" />
        </div>
      </div>
      <div className="card p-6">
        <Bar className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ScreenerPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Bar className="h-8 w-56" />
      <div className="flex gap-2">
        <Bar className="h-9 w-28 rounded-full" />
        <Bar className="h-9 w-28 rounded-full" />
        <Bar className="h-9 w-28 rounded-full" />
        <Bar className="h-9 w-28 rounded-full" />
      </div>
      <TableSkeleton />
    </div>
  );
}
