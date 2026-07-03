// محرك الاختبار التاريخي (Backtest) — دوال نقية بلا أي جلب بيانات.
//
// الفكرة: نعيد بناء شروط الفلتر على كل جلسة ماضية من الشموع اليومية،
// فنعرف أي الأسهم «كانت ستظهر» في الفلتر ذلك اليوم، ثم نقيس ما فعلته
// بعدها: عائد الجلسة التالية، وعائد 5 جلسات، والعائد حتى آخر إغلاق.
//
// حدود صادقة (تُعرض في الواجهة):
// - الشروط تُقاس على أسعار إغلاق الجلسة، بينما الفرز الحي يقيسها لحظياً.
// - الحجم النسبي يُقرَّب بمتوسط 20 جلسة سابقة (بدل متوسط 3 أشهر).
// - الأسهم الحرة الحالية تُطبَّق على الماضي (تتغير ببطء عادة).
// - الكون مأخوذ من الأسهم المتداولة اليوم (انحياز بقاء لا يمكن تجنبه مجاناً).

import { Candle, StrategyKey } from "@/lib/types";

/** استراتيجيات قابلة للاختبار التاريخي (الاستثمار يتطلب قوائم مالية تاريخية) */
export type BacktestStrategy = Extract<StrategyKey, "liquidity" | "momentum">;

export interface BacktestSignal {
  ticker: string;
  name: string;
  /** جلسة الإشارة (unix ثوانٍ) */
  time: number;
  /** إغلاق جلسة الإشارة */
  price: number;
  /** التغير من الافتتاح % في جلسة الإشارة */
  changeFromOpenPercent: number;
  /** تغير الجلسة % */
  changePercent: number;
  /** عائد الجلسة التالية % (null إن لم تكتمل) */
  ret1d: number | null;
  /** عائد 5 جلسات % (null إن لم تكتمل) */
  ret5d: number | null;
  /** العائد حتى آخر إغلاق متاح % */
  retToNow: number | null;
}

export interface BacktestDay {
  time: number;
  signals: BacktestSignal[];
}

export interface BacktestSummary {
  totalSignals: number;
  daysWithSignals: number;
  daysTested: number;
  avgRet1d: number | null;
  avgRet5d: number | null;
  avgRetToNow: number | null;
  /** نسبة الإشارات الموجبة بعد جلسة % */
  winRate1d: number | null;
  /** نسبة الإشارات الموجبة بعد 5 جلسات % */
  winRate5d: number | null;
  best: BacktestSignal | null;
  worst: BacktestSignal | null;
}

export interface BacktestResult {
  strategy: BacktestStrategy;
  days: BacktestDay[];
  summary: BacktestSummary;
}

interface TickerSeries {
  ticker: string;
  name: string;
  candles: Candle[];
}

/** كم جلسة سابقة يحتاجها تقييم شرط عند الفهرس i */
const RELVOL_WINDOW = 20;
const WEEK_SESSIONS = 5;

function pct(now: number, base: number): number {
  return ((now - base) / base) * 100;
}

/** هل تنطبق شروط الاستراتيجية على شمعة الفهرس i من السلسلة؟ */
function matchesAt(
  strategy: BacktestStrategy,
  candles: Candle[],
  i: number
): { changeFromOpenPercent: number; changePercent: number } | null {
  const c = candles[i];
  const prev = candles[i - 1];
  if (!c || !prev || c.open <= 0 || prev.close <= 0) return null;

  const price = c.close;
  const changeFromOpen = pct(c.close, c.open);
  const dayChange = pct(c.close, prev.close);

  // مشترك بين الفلترين: السعر 1-10 والحجم أعلى من 500 ألف
  if (price < 1 || price > 10) return null;
  if (c.volume <= 500_000) return null;

  if (strategy === "liquidity") {
    // التغير من الافتتاح > 10% وأداء اليوم بين -10% و +10%
    if (changeFromOpen <= 10) return null;
    if (dayChange < -10 || dayChange > 10) return null;
  } else {
    // momentum: تغير من الافتتاح > 5%، حجم نسبي > 1، أداء أسبوع > 10%
    if (changeFromOpen <= 5) return null;

    if (i < RELVOL_WINDOW) return null;
    let volSum = 0;
    for (let k = i - RELVOL_WINDOW; k < i; k++) volSum += candles[k].volume;
    const avgVol = volSum / RELVOL_WINDOW;
    if (!(avgVol > 0) || c.volume / avgVol <= 1) return null;

    if (i < WEEK_SESSIONS) return null;
    const weekRef = candles[i - WEEK_SESSIONS];
    if (weekRef.close <= 0 || pct(c.close, weekRef.close) <= 10) return null;
  }

  return { changeFromOpenPercent: changeFromOpen, changePercent: dayChange };
}

/**
 * يشغّل الاختبار على آخر `daysBack` جلسة (باستثناء جلسة اليوم الأخيرة
 * غير المكتملة المحتملة يجري تضمينها — عوائدها الأمامية تكون null).
 */
export function runBacktest(
  strategy: BacktestStrategy,
  series: TickerSeries[],
  daysBack: number
): BacktestResult {
  const byDay = new Map<number, BacktestSignal[]>();
  let daysTested = 0;

  for (const s of series) {
    const { candles } = s;
    if (candles.length < RELVOL_WINDOW + 2) continue;
    const lastClose = candles[candles.length - 1].close;
    const start = Math.max(1, candles.length - daysBack);

    for (let i = start; i < candles.length; i++) {
      const m = matchesAt(strategy, candles, i);
      if (!m) continue;
      const c = candles[i];
      const next = candles[i + 1];
      const week = candles[i + WEEK_SESSIONS];
      const isLast = i === candles.length - 1;

      const signal: BacktestSignal = {
        ticker: s.ticker,
        name: s.name,
        time: c.time,
        price: c.close,
        changeFromOpenPercent: m.changeFromOpenPercent,
        changePercent: m.changePercent,
        ret1d: next && c.close > 0 ? pct(next.close, c.close) : null,
        ret5d: week && c.close > 0 ? pct(week.close, c.close) : null,
        retToNow: !isLast && c.close > 0 ? pct(lastClose, c.close) : null,
      };
      const arr = byDay.get(c.time);
      if (arr) arr.push(signal);
      else byDay.set(c.time, [signal]);
    }
  }

  // عدد الجلسات المُختبرة: من أطول سلسلة
  const longest = series.reduce((m, s) => Math.max(m, s.candles.length), 0);
  daysTested = Math.min(daysBack, Math.max(0, longest - 1));

  const days: BacktestDay[] = Array.from(byDay.entries())
    .map(([time, signals]) => ({
      time,
      signals: signals.sort(
        (a, b) => b.changeFromOpenPercent - a.changeFromOpenPercent
      ),
    }))
    .sort((a, b) => b.time - a.time);

  const all = days.flatMap((d) => d.signals);

  const avg = (xs: number[]): number | null =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const r1 = all.map((s) => s.ret1d).filter((x): x is number => x !== null);
  const r5 = all.map((s) => s.ret5d).filter((x): x is number => x !== null);
  const rn = all
    .map((s) => s.retToNow)
    .filter((x): x is number => x !== null);

  const withR5 = all.filter((s) => s.ret5d !== null);
  const best =
    withR5.length > 0
      ? withR5.reduce((m, s) => ((s.ret5d ?? 0) > (m.ret5d ?? 0) ? s : m))
      : null;
  const worst =
    withR5.length > 0
      ? withR5.reduce((m, s) => ((s.ret5d ?? 0) < (m.ret5d ?? 0) ? s : m))
      : null;

  const summary: BacktestSummary = {
    totalSignals: all.length,
    daysWithSignals: days.length,
    daysTested,
    avgRet1d: avg(r1),
    avgRet5d: avg(r5),
    avgRetToNow: avg(rn),
    winRate1d: r1.length > 0 ? (r1.filter((x) => x > 0).length / r1.length) * 100 : null,
    winRate5d: r5.length > 0 ? (r5.filter((x) => x > 0).length / r5.length) * 100 : null,
    best,
    worst,
  };

  return { strategy, days, summary };
}
