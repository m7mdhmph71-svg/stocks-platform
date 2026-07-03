// محرك الاختبار التاريخي (Backtest) — دوال نقية بلا أي جلب بيانات.
//
// الفكرة: نعيد بناء شروط الفلتر على كل جلسة ماضية من الشموع اليومية،
// فنعرف أي الأسهم «كانت ستظهر» في الفلتر ذلك اليوم، ثم **نحاكي خطة
// التداول التي تقترحها المنصة نفسها**: دخول عند إغلاق جلسة الإشارة،
// وخروج عند الهدف الأول (ربح) أو وقف الخسارة (خسارة) — أيهما يتحقق
// أولاً — أو خروج زمني بعد انقضاء أفق المحاكاة.
//
// قواعد المحاكاة (تحفظية وموثقة في الواجهة):
// - الهدف والوقف يُحسبان بمحرك الأهداف نفسه من بيانات ما قبل الإشارة فقط
//   (لا تسريب من المستقبل).
// - إن لامست الشمعة الهدف والوقف معاً في نفس الجلسة، يُحتسب الوقف (الأسوأ).
// - فجوات الافتتاح: افتتاح دون الوقف → خروج بسعر الافتتاح (أسوأ من الوقف)،
//   وافتتاح فوق الهدف → خروج بسعر الافتتاح (أفضل من الهدف).
// - إشارة لم تُحسم بعد (حديثة) تُعرض «جارية» بعائدها غير المحقق وتُستثنى
//   من الإحصائيات المحسومة.
//
// حدود صادقة (تُعرض في الواجهة):
// - الشروط تُقاس على أسعار إغلاق الجلسة، بينما الفرز الحي يقيسها لحظياً.
// - الحجم النسبي يُقرَّب بمتوسط 20 جلسة سابقة (بدل متوسط 3 أشهر).
// - الأسهم الحرة الحالية تُطبَّق على الماضي (تتغير ببطء عادة).
// - الكون مأخوذ من الأسهم المتداولة اليوم (انحياز بقاء لا يمكن تجنبه مجاناً).

import { Candle, StrategyKey } from "@/lib/types";
import { computeTechnicals } from "@/lib/targets/technicals";
import { computeTargets } from "@/lib/targets/engine";

/** استراتيجيات قابلة للاختبار التاريخي (الاستثمار يتطلب قوائم مالية تاريخية) */
export type BacktestStrategy = Extract<StrategyKey, "liquidity" | "momentum">;

export type TradeOutcome = "target" | "stop" | "time" | "open";

export interface BacktestSignal {
  ticker: string;
  name: string;
  /** جلسة الإشارة (unix ثوانٍ) */
  time: number;
  /** سعر الدخول = إغلاق جلسة الإشارة */
  price: number;
  /** التغير من الافتتاح % في جلسة الإشارة */
  changeFromOpenPercent: number;
  /** تغير الجلسة % */
  changePercent: number;

  /** الهدف الأول من محرك الأهداف (محسوب من بيانات ما قبل الإشارة فقط) */
  target: number;
  /** وقف الخسارة من محرك الأهداف */
  stop: number;
  /** نتيجة الصفقة المحاكاة */
  outcome: TradeOutcome;
  /** سعر الخروج (null للصفقات الجارية) */
  exitPrice: number | null;
  /** عائد الصفقة % (محقق للمحسومة، غير محقق حتى آخر إغلاق للجارية) */
  tradeReturnPercent: number | null;
  /** عدد الجلسات حتى الخروج (null للجارية) */
  sessionsHeld: number | null;
}

export interface BacktestDay {
  time: number;
  signals: BacktestSignal[];
}

export interface BacktestSummary {
  totalSignals: number;
  daysWithSignals: number;
  daysTested: number;
  /** صفقات محسومة (هدف/وقف/زمني) */
  closedTrades: number;
  openTrades: number;
  targetHits: number;
  stopHits: number;
  timeExits: number;
  /** نسبة إصابة الهدف من المحسومة % */
  targetHitRate: number | null;
  /** نسبة ضرب الوقف من المحسومة % */
  stopHitRate: number | null;
  /** متوسط عائد الصفقة المحسومة % */
  avgTradeReturn: number | null;
  /** معامل الربح: مجموع الأرباح ÷ مجموع الخسائر المطلقة (null بلا خسائر) */
  profitFactor: number | null;
  /** متوسط مدة الصفقة المحسومة بالجلسات */
  avgSessionsHeld: number | null;
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

/** كم جلسة سابقة يحتاجها تقييم الشروط والمؤشرات عند الفهرس i */
const MIN_HISTORY = 21;
const RELVOL_WINDOW = 20;
const WEEK_SESSIONS = 5;
/** أفق المحاكاة: أقصى جلسات احتفاظ قبل الخروج الزمني */
export const TRADE_HORIZON = 15;

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

    let volSum = 0;
    for (let k = i - RELVOL_WINDOW; k < i; k++) volSum += candles[k].volume;
    const avgVol = volSum / RELVOL_WINDOW;
    if (!(avgVol > 0) || c.volume / avgVol <= 1) return null;

    const weekRef = candles[i - WEEK_SESSIONS];
    if (weekRef.close <= 0 || pct(c.close, weekRef.close) <= 10) return null;
  }

  return { changeFromOpenPercent: changeFromOpen, changePercent: dayChange };
}

/** خطة الصفقة عند الإشارة: الهدف الأول والوقف من محرك الأهداف نفسه */
function planAt(
  strategy: BacktestStrategy,
  candles: Candle[],
  i: number
): { target: number; stop: number } | null {
  // بيانات ما قبل الإشارة وشمعتها فقط — لا تسريب من المستقبل
  const tech = computeTechnicals(candles.slice(0, i + 1));
  const entry = candles[i].close;
  const t = computeTargets(strategy, entry, tech, null);
  const target = t.targets[0]?.price ?? null;
  const stop = t.stopLoss;
  if (target === null || stop === null) return null;
  if (!(target > entry) || !(stop < entry) || stop <= 0) return null;
  return { target, stop };
}

/** محاكاة الصفقة بعد الإشارة عند الفهرس i */
function simulateTrade(
  candles: Candle[],
  i: number,
  entry: number,
  target: number,
  stop: number
): {
  outcome: TradeOutcome;
  exitPrice: number | null;
  tradeReturnPercent: number | null;
  sessionsHeld: number | null;
} {
  const lastIndex = candles.length - 1;
  const end = Math.min(i + TRADE_HORIZON, lastIndex);

  for (let j = i + 1; j <= end; j++) {
    const c = candles[j];
    // فجوة افتتاح تحت الوقف → خروج بسعر الافتتاح (أسوأ من الوقف)
    if (c.open <= stop) {
      return {
        outcome: "stop",
        exitPrice: c.open,
        tradeReturnPercent: pct(c.open, entry),
        sessionsHeld: j - i,
      };
    }
    // فجوة افتتاح فوق الهدف → خروج بسعر الافتتاح (أفضل من الهدف)
    if (c.open >= target) {
      return {
        outcome: "target",
        exitPrice: c.open,
        tradeReturnPercent: pct(c.open, entry),
        sessionsHeld: j - i,
      };
    }
    // داخل الجلسة: الوقف يُغلَّب تحفظاً إن لامسا معاً
    if (c.low <= stop) {
      return {
        outcome: "stop",
        exitPrice: stop,
        tradeReturnPercent: pct(stop, entry),
        sessionsHeld: j - i,
      };
    }
    if (c.high >= target) {
      return {
        outcome: "target",
        exitPrice: target,
        tradeReturnPercent: pct(target, entry),
        sessionsHeld: j - i,
      };
    }
  }

  // لم يتحقق هدف ولا وقف داخل الأفق
  if (i + TRADE_HORIZON <= lastIndex) {
    const exit = candles[end].close;
    return {
      outcome: "time",
      exitPrice: exit,
      tradeReturnPercent: pct(exit, entry),
      sessionsHeld: end - i,
    };
  }

  // الأفق لم يكتمل بعد — صفقة جارية بعائد غير محقق حتى آخر إغلاق
  const lastClose = candles[lastIndex].close;
  return {
    outcome: "open",
    exitPrice: null,
    tradeReturnPercent: i < lastIndex ? pct(lastClose, entry) : null,
    sessionsHeld: null,
  };
}

/** يلخّص أيام الاختبار — يُستدعى أيضاً بعد فلترة الأسهم الحرة في الـ API */
export function summarizeBacktest(
  days: BacktestDay[],
  daysTested: number
): BacktestSummary {
  const all = days.flatMap((d) => d.signals);
  const closed = all.filter((s) => s.outcome !== "open");
  const rets = closed
    .map((s) => s.tradeReturnPercent)
    .filter((x): x is number => x !== null);

  const targetHits = closed.filter((s) => s.outcome === "target").length;
  const stopHits = closed.filter((s) => s.outcome === "stop").length;
  const timeExits = closed.filter((s) => s.outcome === "time").length;

  const gains = rets.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const losses = rets.filter((x) => x < 0).reduce((a, b) => a + b, 0);

  const held = closed
    .map((s) => s.sessionsHeld)
    .filter((x): x is number => x !== null);

  const withRet = closed.filter((s) => s.tradeReturnPercent !== null);

  return {
    totalSignals: all.length,
    daysWithSignals: days.length,
    daysTested,
    closedTrades: closed.length,
    openTrades: all.length - closed.length,
    targetHits,
    stopHits,
    timeExits,
    targetHitRate:
      closed.length > 0 ? (targetHits / closed.length) * 100 : null,
    stopHitRate: closed.length > 0 ? (stopHits / closed.length) * 100 : null,
    avgTradeReturn:
      rets.length > 0 ? rets.reduce((a, b) => a + b, 0) / rets.length : null,
    profitFactor: losses < 0 ? gains / Math.abs(losses) : null,
    avgSessionsHeld:
      held.length > 0 ? held.reduce((a, b) => a + b, 0) / held.length : null,
    best:
      withRet.length > 0
        ? withRet.reduce((m, s) =>
            (s.tradeReturnPercent ?? -Infinity) >
            (m.tradeReturnPercent ?? -Infinity)
              ? s
              : m
          )
        : null,
    worst:
      withRet.length > 0
        ? withRet.reduce((m, s) =>
            (s.tradeReturnPercent ?? Infinity) <
            (m.tradeReturnPercent ?? Infinity)
              ? s
              : m
          )
        : null,
  };
}

/** يشغّل الاختبار على آخر `daysBack` جلسة */
export function runBacktest(
  strategy: BacktestStrategy,
  series: TickerSeries[],
  daysBack: number
): BacktestResult {
  const byDay = new Map<number, BacktestSignal[]>();

  for (const s of series) {
    const { candles } = s;
    if (candles.length < MIN_HISTORY + 2) continue;
    const start = Math.max(MIN_HISTORY, candles.length - daysBack);

    for (let i = start; i < candles.length; i++) {
      const m = matchesAt(strategy, candles, i);
      if (!m) continue;
      const plan = planAt(strategy, candles, i);
      if (!plan) continue; // لا خطة صالحة (مؤشرات غير كافية) — نتخطى بصدق

      const c = candles[i];
      const sim = simulateTrade(candles, i, c.close, plan.target, plan.stop);

      const signal: BacktestSignal = {
        ticker: s.ticker,
        name: s.name,
        time: c.time,
        price: c.close,
        changeFromOpenPercent: m.changeFromOpenPercent,
        changePercent: m.changePercent,
        target: plan.target,
        stop: plan.stop,
        ...sim,
      };
      const arr = byDay.get(c.time);
      if (arr) arr.push(signal);
      else byDay.set(c.time, [signal]);
    }
  }

  const longest = series.reduce((m, s) => Math.max(m, s.candles.length), 0);
  const daysTested = Math.min(daysBack, Math.max(0, longest - MIN_HISTORY));

  const days: BacktestDay[] = Array.from(byDay.entries())
    .map(([time, signals]) => ({
      time,
      signals: signals.sort(
        (a, b) => b.changeFromOpenPercent - a.changeFromOpenPercent
      ),
    }))
    .sort((a, b) => b.time - a.time);

  return { strategy, days, summary: summarizeBacktest(days, daysTested) };
}
