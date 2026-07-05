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

// ============================================================
// مقارنة صيغ الهدف/الوقف — نفس الإشارات، أربع طرق خروج:
//   classic   الصيغة الكلاسيكية (ATR والمحاور — صيغة المنصة السابقة)
//   structure الصيغة الهيكلية (قيعان متأرجحة + حارس مضاعف المخاطرة)
//   trail     وقف هيكلي ثم متحرك Chandelier (أعلى قمة − 3×ATR) بلا هدف ثابت
//   hybrid    نصف الكمية عند الهدف الأول + النصف الباقي بوقف متحرك
//             لا ينزل تحت سعر الدخول — خطة المنصة المنصوح بها نصاً
// ============================================================

export type ExitFormulaKey =
  | "classic"
  | "structure"
  | "trail"
  | "hybrid"
  | "overnight"
  | "nextclose";

export interface VariantSummary {
  key: ExitFormulaKey;
  labelAr: string;
  descriptionAr: string;
  closedTrades: number;
  /** نسبة الصفقات الرابحة % */
  winRate: number | null;
  avgTradeReturn: number | null;
  profitFactor: number | null;
  avgSessionsHeld: number | null;
}

export const VARIANT_META: Record<
  ExitFormulaKey,
  { labelAr: string; descriptionAr: string }
> = {
  classic: {
    labelAr: "الكلاسيكية",
    descriptionAr: "ATR والنقاط المحورية — صيغة المنصة السابقة",
  },
  structure: {
    labelAr: "الهيكلية",
    descriptionAr:
      "وقف تحت آخر قاع متأرجح + أهداف على مستويات فعلية بحارس عائد/مخاطرة",
  },
  trail: {
    labelAr: "الوقف المتحرك",
    descriptionAr: "وقف هيكلي يتحول لمتحرك (أعلى قمة − 3×ATR) بلا هدف ثابت",
  },
  hybrid: {
    labelAr: "الهجينة",
    descriptionAr:
      "نصف الكمية عند الهدف الأول والباقي بوقف متحرك لا ينزل تحت الدخول",
  },
  overnight: {
    labelAr: "ليلة واحدة",
    descriptionAr:
      "شراء بإغلاق الإشارة وبيع بافتتاح الجلسة التالية — اختبار توقيت خالص بلا هدف ولا وقف",
  },
  nextclose: {
    labelAr: "جلسة واحدة",
    descriptionAr:
      "شراء بإغلاق الإشارة وبيع بإغلاق الجلسة التالية — اختبار توقيت خالص بلا هدف ولا وقف",
  },
};

interface SimOutcome {
  ret: number;
  sessions: number;
}

/** الوقف المتحرك Chandelier: يُحدَّث من قمم الجلسات السابقة فقط (لا تفاؤل لحظي) */
function simulateTrailExit(
  candles: Candle[],
  i: number,
  entry: number,
  stop0: number,
  atr: number,
  horizonEnd: number,
  stopFloor: number | null
): SimOutcome | null {
  let trail = stop0;
  let maxHigh = candles[i].high;

  for (let j = i + 1; j <= horizonEnd; j++) {
    const c = candles[j];
    // وقف الجلسة من بيانات ما قبلها
    let level = Math.max(trail, maxHigh - 3 * atr);
    if (stopFloor !== null) level = Math.max(level, stopFloor);

    if (c.open <= level) {
      return { ret: pct(c.open, entry), sessions: j - i };
    }
    if (c.low <= level) {
      return { ret: pct(level, entry), sessions: j - i };
    }
    trail = level;
    if (c.high > maxHigh) maxHigh = c.high;
  }

  if (horizonEnd < candles.length - 1 || i + TRADE_HORIZON <= candles.length - 1) {
    return { ret: pct(candles[horizonEnd].close, entry), sessions: horizonEnd - i };
  }
  return null; // الأفق لم يكتمل — صفقة جارية تُستثنى من المقارنة
}

/** خروج بخطة ثابتة (هدف/وقف) — نسخة مختصرة تعيد null للجارية */
function simulateFixedExit(
  candles: Candle[],
  i: number,
  entry: number,
  target: number,
  stop: number
): SimOutcome | null {
  const sim = simulateTrade(candles, i, entry, target, stop);
  if (sim.outcome === "open" || sim.tradeReturnPercent === null) return null;
  return { ret: sim.tradeReturnPercent, sessions: sim.sessionsHeld ?? 0 };
}

/** الهجينة: نصف عند الهدف الأول، والباقي بوقف متحرك أرضيته سعر الدخول */
function simulateHybridExit(
  candles: Candle[],
  i: number,
  entry: number,
  target: number,
  stop: number,
  atr: number
): SimOutcome | null {
  const lastIndex = candles.length - 1;
  const end = Math.min(i + TRADE_HORIZON, lastIndex);

  for (let j = i + 1; j <= end; j++) {
    const c = candles[j];
    // الوقف يُغلَّب تحفظاً (نفس قواعد الخطة الثابتة)
    if (c.open <= stop) return { ret: pct(c.open, entry), sessions: j - i };
    if (c.low <= stop) return { ret: pct(stop, entry), sessions: j - i };

    const t1Price = c.open >= target ? c.open : c.high >= target ? target : null;
    if (t1Price !== null) {
      // تحقق الهدف الأول: نصف يُجنى الآن، والباقي بوقف متحرك من الجلسة التالية
      const half1 = pct(t1Price, entry);
      const rest = simulateTrailExit(
        candles,
        j,
        entry,
        Math.max(stop, entry),
        atr,
        end,
        entry // «ارفع الوقف لسعر الدخول» — لا ينزل تحته
      );
      if (rest === null) return null; // الباقي جارٍ — الصفقة كلها تُستثنى
      return {
        ret: (half1 + rest.ret) / 2,
        sessions: Math.max(j - i, rest.sessions + (j - i)),
      };
    }
  }

  if (i + TRADE_HORIZON <= lastIndex) {
    return { ret: pct(candles[end].close, entry), sessions: end - i };
  }
  return null;
}

function summarizeVariant(
  key: ExitFormulaKey,
  outcomes: SimOutcome[]
): VariantSummary {
  const rets = outcomes.map((o) => o.ret);
  const wins = rets.filter((r) => r > 0);
  const gains = wins.reduce((a, b) => a + b, 0);
  const losses = rets.filter((r) => r < 0).reduce((a, b) => a + b, 0);
  const sessions = outcomes.map((o) => o.sessions);
  return {
    key,
    ...VARIANT_META[key],
    closedTrades: outcomes.length,
    winRate: outcomes.length > 0 ? (wins.length / outcomes.length) * 100 : null,
    avgTradeReturn:
      rets.length > 0 ? rets.reduce((a, b) => a + b, 0) / rets.length : null,
    profitFactor: losses < 0 ? gains / Math.abs(losses) : null,
    avgSessionsHeld:
      sessions.length > 0
        ? sessions.reduce((a, b) => a + b, 0) / sessions.length
        : null,
  };
}

export interface FormulaComparison {
  strategy: BacktestStrategy;
  totalSignals: number;
  daysTested: number;
  variants: VariantSummary[];
}

/** يقارن صيغ الخروج الأربع على نفس إشارات الفترة */
export function runFormulaComparison(
  strategy: BacktestStrategy,
  series: { ticker: string; name: string; candles: Candle[] }[],
  daysBack: number
): FormulaComparison {
  const buckets: Record<ExitFormulaKey, SimOutcome[]> = {
    classic: [],
    structure: [],
    trail: [],
    hybrid: [],
    overnight: [],
    nextclose: [],
  };
  let totalSignals = 0;

  for (const s of series) {
    const { candles } = s;
    if (candles.length < MIN_HISTORY + 2) continue;
    const start = Math.max(MIN_HISTORY, candles.length - daysBack);

    for (let i = start; i < candles.length; i++) {
      if (!matchesAt(strategy, candles, i)) continue;

      const tech = computeTechnicals(candles.slice(0, i + 1));
      const entry = candles[i].close;
      const atr = tech.atr14;
      if (atr === null || atr <= 0) continue;

      const classic = computeTargets(strategy, entry, tech, null, "classic");
      const structure = computeTargets(strategy, entry, tech, null, "structure");
      const cT = classic.targets[0]?.price ?? null;
      const cS = classic.stopLoss;
      const sT = structure.targets[0]?.price ?? null;
      const sS = structure.stopLoss;
      if (cT === null || cS === null || sT === null || sS === null) continue;
      if (!(cT > entry && cS < entry && cS > 0)) continue;
      if (!(sT > entry && sS < entry && sS > 0)) continue;

      totalSignals++;
      const horizonEnd = Math.min(i + TRADE_HORIZON, candles.length - 1);

      const rClassic = simulateFixedExit(candles, i, entry, cT, cS);
      if (rClassic) buckets.classic.push(rClassic);

      const rStructure = simulateFixedExit(candles, i, entry, sT, sS);
      if (rStructure) buckets.structure.push(rStructure);

      const rTrail = simulateTrailExit(candles, i, entry, sS, atr, horizonEnd, null);
      if (rTrail) buckets.trail.push(rTrail);

      const rHybrid = simulateHybridExit(candles, i, entry, sT, sS, atr);
      if (rHybrid) buckets.hybrid.push(rHybrid);

      // اختبارا التوقيت الخالص: أين نافذة الربح حول الإشارة؟
      if (i + 1 < candles.length) {
        const next = candles[i + 1];
        if (next.open > 0) {
          buckets.overnight.push({ ret: pct(next.open, entry), sessions: 1 });
        }
        if (next.close > 0) {
          buckets.nextclose.push({ ret: pct(next.close, entry), sessions: 1 });
        }
      }
    }
  }

  const longest = series.reduce((m, s) => Math.max(m, s.candles.length), 0);
  return {
    strategy,
    totalSignals,
    daysTested: Math.min(daysBack, Math.max(0, longest - MIN_HISTORY)),
    variants: (Object.keys(buckets) as ExitFormulaKey[]).map((k) =>
      summarizeVariant(k, buckets[k])
    ),
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
