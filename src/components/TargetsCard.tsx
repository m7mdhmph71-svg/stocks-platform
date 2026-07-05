"use client";

import { StrategyKey, TargetsResult, Trend } from "@/lib/types";
import { fmtNum, fmtPercent, fmtPrice } from "@/lib/format";

const STRATEGY_ORDER: StrategyKey[] = ["liquidity", "momentum", "trend", "longterm"];

const REC_AR: Record<string, string> = {
  strong_buy: "شراء قوي",
  buy: "شراء",
  hold: "احتفاظ",
  underperform: "أداء أدنى من السوق",
  sell: "بيع",
};

function TrendChip({
  trend,
  trendAr,
}: {
  trend: Trend | null;
  trendAr: string | null;
}) {
  if (!trend) {
    return <span className="chip">الاتجاه غير محدد</span>;
  }
  const map: Record<Trend, { arrow: string; cls: string; fallback: string }> = {
    UP: {
      arrow: "↗",
      cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-300",
      fallback: "اتجاه صاعد",
    },
    DOWN: {
      arrow: "↘",
      cls: "border-red-300 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300",
      fallback: "اتجاه هابط",
    },
    SIDEWAYS: {
      arrow: "↔",
      cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-300",
      fallback: "اتجاه عرضي",
    },
  };
  const m = map[trend];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${m.cls}`}
    >
      <span aria-hidden className="text-sm leading-none">
        {m.arrow}
      </span>
      {trendAr ?? m.fallback}
    </span>
  );
}

function ScoreMeter({ score }: { score: number | null }) {
  if (score === null || !isFinite(score)) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        درجة الفرصة: بيانات غير كافية
      </p>
    );
  }
  const v = Math.max(0, Math.min(100, score));
  const color =
    v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          درجة الفرصة
        </span>
        <span
          dir="ltr"
          className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50"
        >
          {Math.round(v)} / 100
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        aria-label="درجة الفرصة"
      >
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function TargetsCard({
  byStrategy,
  currency = "$",
  selected,
  onSelect,
  analystTarget,
  analystRecommendation,
}: {
  byStrategy: Record<StrategyKey, TargetsResult>;
  /** عملة العرض (افتراضياً دولار) */
  currency?: string;
  selected: StrategyKey;
  onSelect: (k: StrategyKey) => void;
  analystTarget: number | null;
  analystRecommendation: string | null;
}) {
  const t = byStrategy[selected];

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        الأهداف والتوقعات
      </h2>

      {/* تبويبات الاستراتيجيات */}
      <div
        role="tablist"
        aria-label="استراتيجية الأهداف"
        className="mb-5 flex flex-wrap gap-2"
      >
        {STRATEGY_ORDER.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={selected === k}
            type="button"
            onClick={() => onSelect(k)}
            className={
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors " +
              (selected === k
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-zinc-300 bg-white text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400")
            }
          >
            {byStrategy[k].strategyAr}
          </button>
        ))}
      </div>

      {/* الاتجاه + العائد/المخاطرة */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TrendChip trend={t.trend} trendAr={t.trendAr} />
        {t.riskReward !== null && isFinite(t.riskReward) ? (
          <span className="chip border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
            العائد/المخاطرة{" "}
            <b className="tabular-nums" dir="ltr">
              {fmtNum(t.riskReward, 2)}
            </b>
          </span>
        ) : null}
      </div>

      {/* الدخول والوقف */}
      <dl className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">
            سعر الدخول المرجعي
          </dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {fmtPrice(t.entry, currency)}
          </dd>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900/50 dark:bg-red-950/30">
          <dt className="text-xs text-red-700/80 dark:text-red-300/80">
            وقف الخسارة
          </dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-red-700 dark:text-red-300">
            {fmtPrice(t.stopLoss, currency)}
          </dd>
          {t.stopLossBasisAr ? (
            <p className="mt-1 text-[11px] leading-4 text-red-700/70 dark:text-red-300/70">
              {t.stopLossBasisAr}
            </p>
          ) : null}
        </div>
      </dl>

      {/* الأهداف */}
      {t.targets.length > 0 ? (
        <ol className="mb-5 space-y-2">
          {t.targets.map((lvl, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {lvl.label}
                  </span>
                  <span className="text-xs text-emerald-700 tabular-nums dark:text-emerald-300">
                    {fmtPercent(lvl.percent)}
                  </span>
                </div>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {lvl.basisAr}
                </p>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {fmtPrice(lvl.price, currency)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          لا تتوفر أهداف محسوبة لهذه الاستراتيجية.
        </p>
      )}

      {/* الدرجة */}
      <div className="mb-5">
        <ScoreMeter score={t.score} />
      </div>

      {/* التوقع */}
      <p className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-sm leading-7 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200">
        {t.expectationAr}
      </p>

      {/* هدف المحللين */}
      {analystTarget !== null ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
          <span className="text-sky-800 dark:text-sky-200">
            متوسط هدف المحللين
            {analystRecommendation ? (
              <span className="ms-2 text-xs text-sky-700/80 dark:text-sky-300/80">
                التوصية: {REC_AR[analystRecommendation] ?? analystRecommendation}
              </span>
            ) : null}
          </span>
          <span className="font-bold tabular-nums text-sky-800 dark:text-sky-200">
            {fmtPrice(analystTarget, currency)}
          </span>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
        حسابات فنية آلية وليست توصية استثمارية.
      </p>
    </section>
  );
}
