"use client";

// الاختبار التاريخي للفلاتر: يعيد بناء نتائج الفلتر في الجلسات الماضية
// ويعرض أداءها بعد الإشارة — تقييم موضوعي لجودة الفلتر.

import { useCallback, useState } from "react";
import Link from "next/link";
import { fetchJson, fmtShortDateAr } from "@/components/ui";
import { fmtPercent, fmtPrice, changeColorClass } from "@/lib/format";
import { ErrorBox } from "@/components/States";
import type { BacktestResponse } from "@/app/api/backtest/route";

type Strategy = "liquidity" | "momentum";

const STRATEGY_LABELS: Record<Strategy, string> = {
  liquidity: "صيد السيولة",
  momentum: "الزخم / السوينق",
};

const DAY_OPTIONS = [10, 20, 30, 40];

function StatTile({
  label,
  value,
  colorClass,
  hint,
}: {
  label: string;
  value: string;
  colorClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={
          "mt-1 text-lg font-bold tabular-nums " +
          (colorClass ?? "text-zinc-900 dark:text-zinc-50")
        }
        dir="ltr"
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function BacktestPanel() {
  const [strategy, setStrategy] = useState<Strategy>("momentum");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranFor, setRanFor] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const key = `${strategy}:${days}`;
    fetchJson<BacktestResponse>(`/api/backtest?preset=${strategy}&days=${days}`)
      .then((res) => {
        setData(res);
        setRanFor(key);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "تعذّر تنفيذ الاختبار.");
      })
      .finally(() => setLoading(false));
  }, [strategy, days]);

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          الاختبار التاريخي للفلتر
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          نعيد بناء شروط الفلتر على الجلسات الماضية لنعرف أي الأسهم كانت
          ستظهر فيه كل يوم، ثم نقيس ما فعلته بعد الإشارة — حكمٌ موضوعي على
          جودة الفلتر قبل أن تثق به.
        </p>
      </div>

      {/* أدوات التشغيل */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setStrategy(k)}
            className={
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
              (strategy === k
                ? "bg-brand-600 text-white"
                : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300")
            }
          >
            {STRATEGY_LABELS[k]}
          </button>
        ))}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label="عدد الجلسات"
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              آخر {d} جلسة
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "جارٍ الاختبار…" : "شغّل الاختبار"}
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          فلتر الاستثمار غير قابل للاختبار التاريخي (يتطلب قوائم مالية «كما
          كانت» — غير متاحة مجاناً).
        </span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent align-middle" />{" "}
          نفحص مئات الأسهم عبر {days} جلسة — قد يستغرق حتى دقيقة أول مرة،
          والنتائج تُحفظ بعدها.
        </div>
      ) : null}

      {error ? <ErrorBox message={error} onRetry={run} /> : null}

      {data && !loading ? (
        <div className="space-y-4">
          {/* الملخص */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="إشارات الفلتر"
              value={String(data.summary.totalSignals)}
              hint={`في ${data.summary.daysWithSignals} جلسة من ${days}`}
            />
            <StatTile
              label="متوسط عائد الجلسة التالية"
              value={fmtPercent(data.summary.avgRet1d)}
              colorClass={changeColorClass(data.summary.avgRet1d)}
            />
            <StatTile
              label="متوسط عائد 5 جلسات"
              value={fmtPercent(data.summary.avgRet5d)}
              colorClass={changeColorClass(data.summary.avgRet5d)}
            />
            <StatTile
              label="نسبة الرابحة بعد جلسة"
              value={fmtPercent(data.summary.winRate1d, 0).replace("+", "")}
            />
            <StatTile
              label="نسبة الرابحة بعد 5 جلسات"
              value={fmtPercent(data.summary.winRate5d, 0).replace("+", "")}
            />
            <StatTile
              label="متوسط العائد حتى الآن"
              value={fmtPercent(data.summary.avgRetToNow)}
              colorClass={changeColorClass(data.summary.avgRetToNow)}
            />
          </div>

          {data.summary.best && data.summary.worst ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">
                أفضل إشارة (5 جلسات):{" "}
                <Link
                  href={`/stock/${data.summary.best.ticker}`}
                  className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                  dir="ltr"
                >
                  {data.summary.best.ticker}
                </Link>{" "}
                <span
                  className={"font-bold " + changeColorClass(data.summary.best.ret5d)}
                  dir="ltr"
                >
                  {fmtPercent(data.summary.best.ret5d)}
                </span>
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">
                أسوأ إشارة:{" "}
                <Link
                  href={`/stock/${data.summary.worst.ticker}`}
                  className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                  dir="ltr"
                >
                  {data.summary.worst.ticker}
                </Link>{" "}
                <span
                  className={
                    "font-bold " + changeColorClass(data.summary.worst.ret5d)
                  }
                  dir="ltr"
                >
                  {fmtPercent(data.summary.worst.ret5d)}
                </span>
              </span>
            </div>
          ) : null}

          {/* ملاحظات المنهجية */}
          <ul className="space-y-1">
            {data.notesAr.map((n, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {n}
              </li>
            ))}
          </ul>

          {/* الإشارات يوماً بيوم */}
          {data.days.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              لم يُصدر الفلتر أي إشارة خلال آخر {days} جلسة — الفلاتر
              الانتقائية قد تصمت أياماً، وهذا بحد ذاته معلومة.
            </p>
          ) : (
            <div className="space-y-3">
              {data.days.map((d) => (
                <details
                  key={d.time}
                  className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                  open={d === data.days[0]}
                >
                  <summary className="cursor-pointer bg-zinc-50 px-4 py-2.5 text-sm font-bold text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:bg-zinc-800">
                    {fmtShortDateAr(d.time)} —{" "}
                    <span className="tabular-nums">{d.signals.length}</span>{" "}
                    {d.signals.length === 1 ? "إشارة" : "إشارات"}
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          <th className="p-2.5 text-start font-medium">الرمز</th>
                          <th className="p-2.5 text-end font-medium">سعر الإشارة</th>
                          <th className="p-2.5 text-end font-medium">من الافتتاح</th>
                          <th className="p-2.5 text-end font-medium">+ جلسة</th>
                          <th className="p-2.5 text-end font-medium">+ 5 جلسات</th>
                          <th className="p-2.5 text-end font-medium">حتى الآن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.signals.map((s) => (
                          <tr
                            key={s.ticker + s.time}
                            className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                          >
                            <td className="p-2.5">
                              <Link
                                href={`/stock/${s.ticker}`}
                                className="font-bold text-brand-700 hover:underline dark:text-brand-400"
                                dir="ltr"
                              >
                                {s.ticker}
                              </Link>
                              <span className="ms-2 hidden max-w-[10rem] truncate align-middle text-xs text-zinc-400 sm:inline-block dark:text-zinc-500">
                                {s.name}
                              </span>
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-zinc-900 dark:text-zinc-50">
                              {fmtPrice(s.price)}
                            </td>
                            <td className="p-2.5 text-end tabular-nums text-zinc-600 dark:text-zinc-300">
                              <span dir="ltr">
                                {fmtPercent(s.changeFromOpenPercent, 1)}
                              </span>
                            </td>
                            {[s.ret1d, s.ret5d, s.retToNow].map((r, i) => (
                              <td
                                key={i}
                                className={
                                  "p-2.5 text-end font-bold tabular-nums " +
                                  changeColorClass(r)
                                }
                              >
                                <span dir="ltr">{fmtPercent(r, 1)}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
