/** عدّاد دائري ثابت يوضّح حداً شرعياً (مثل 30%) — SVG نقي بلا تفاعل */
export function LimitDonut({
  percent,
  label,
  sublabel,
}: {
  percent: number;
  label: string;
  sublabel: string;
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * c;

  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <svg
        viewBox="0 0 100 100"
        className="h-28 w-28"
        role="img"
        aria-label={`الحد الأقصى ${percent}%`}
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="#10b981"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          className="fill-zinc-900 dark:fill-zinc-50"
          fontSize="20"
          fontWeight="700"
        >
          {percent}%
        </text>
      </svg>
      <div>
        <p className="font-bold text-zinc-900 dark:text-zinc-50">{label}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {sublabel}
        </p>
      </div>
    </div>
  );
}
