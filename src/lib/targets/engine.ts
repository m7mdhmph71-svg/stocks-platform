// ============================================================
// محرك الأهداف والتوقعات — دوال نقية حتمية (بلا أي جلب بيانات).
//
// استراتيجيتان معتمدتان (liquidity, trend) كلتاهما على الصيغة الهيكلية:
//  - الوقف يعرّف المخاطرة 1R: قاع متأرجح فعلي بهامش ربع ATR (ضمن
//    [0.75, 2.5]×ATR)، وإلا وقف ATR محكوم عند 1.5× — لا يسقط لوقف
//    SMA20 البعيد الذي يقلب العائد/المخاطرة.
//  - الأهداف مضاعفات R على أقرب مستوى فعلي (قمم متأرجحة، محاور R1-R3،
//    قمم 50ي/52أ): الهدف الأول ≥ 1R والثاني ≥ 2R — فلا تُقترح صفقة
//    عائدها أقل من مخاطرتها.
//
// «الكلاسيكية» classic تبقى داخلياً لمقارنة الاختبار التاريخي فقط
// (buildLiquidity للسيولة، buildMomentum للاتجاه) — كانت تعطي عائد/مخاطرة
// 0.1-0.3 مقلوباً فلم تعد افتراضاً معروضاً.
//
// عند غياب بيانات فنية تُستبدل مستويات نسبية موثّقة في basisAr،
// وتُضمن أهداف تصاعدية فوق سعر الدخول (أي مستوى دونه يُعدَّل بأقل
// تعديل منطقي مع توثيق التعديل في basisAr).
// ============================================================

import {
  StrategyKey,
  TargetLevel,
  TargetsResult,
  TechnicalSnapshot,
  Trend,
} from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { STRATEGY_NAMES_AR } from "@/lib/filters/presets";

interface RawTarget {
  price: number;
  basisAr: string;
}

interface RawStop {
  price: number;
  basisAr: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** تقريب سعري: 4 منازل تحت الدولار، ومنزلتان فوقه */
function roundPrice(p: number): number {
  return p < 1 ? Math.round(p * 10000) / 10000 : round2(p);
}

function isPos(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

const TARGET_LABELS = ["الهدف الأول", "الهدف الثاني", "الهدف الثالث"] as const;

/** صيغة حساب الأهداف/الوقف للمضاربة — الهيكلية هي الافتراضية */
export type TargetFormula = "structure" | "classic";

/**
 * ضمان أهداف تصاعدية حصراً فوق سعر الدخول: أي مستوى خام دون المستوى
 * السابق (أو دون الدخول) يُرفع بأقل خطوة منطقية ويوثَّق التعديل.
 */
function normalizeTargets(entry: number, raw: RawTarget[]): TargetLevel[] {
  const step = Math.max(entry * 0.01, 0.01);
  const out: TargetLevel[] = [];
  let prev = entry;
  for (let i = 0; i < raw.length && i < 3; i++) {
    let price = raw[i].price;
    let basisAr = raw[i].basisAr;
    const floor = prev + step;
    if (!Number.isFinite(price) || price < floor) {
      basisAr = `${basisAr} (عُدّل صعوداً بأقل خطوة للحفاظ على ترتيب تصاعدي فوق سعر الدخول)`;
      price = floor;
    }
    price = roundPrice(price);
    if (price <= prev) price = roundPrice(prev + step);
    out.push({
      label: TARGET_LABELS[i],
      price,
      percent: round2((price / entry - 1) * 100),
      basisAr,
    });
    prev = price;
  }
  return out;
}

/** اختيار الوقف الأقرب حماية (الأعلى) من مرشحات صالحة تحت سعر الدخول */
function pickStop(
  entry: number,
  candidates: (RawStop | null)[],
  fallback: RawStop
): RawStop {
  let best: RawStop | null = null;
  for (const c of candidates) {
    if (c === null) continue;
    if (!(c.price > 0 && c.price < entry)) continue;
    if (best === null || c.price > best.price) best = c;
  }
  const chosen = best ?? fallback;
  return { price: roundPrice(chosen.price), basisAr: chosen.basisAr };
}

/**
 * وقف بنية السوق: تحت أعلى قاع متأرجح تحت سعر الدخول بهامش ربع ATR،
 * بشرط ألا يكون خانقاً (< 0.75×ATR) ولا بعيداً مبدداً (> 2.5×ATR).
 * تُجرَّب القيعان من الأعلى إلى الأدنى حتى يصح الشرط.
 */
function structuralStop(
  entry: number,
  atr: number,
  swingLows: number[]
): RawStop | null {
  const below = swingLows
    .filter((sl) => sl > 0 && sl < entry)
    .sort((a, b) => b - a);
  for (const sl of below) {
    const price = sl - 0.25 * atr;
    if (price <= 0) continue;
    const dist = entry - price;
    if (dist < 0.75 * atr) continue; // خانق — جرّب القاع الأدنى التالي
    if (dist > 2.5 * atr) break; // القيعان الأدنى ستكون أبعد — لا جدوى
    return {
      price: roundPrice(price),
      basisAr: "تحت آخر قاع متأرجح فعلي في الشارت بهامش ربع ATR (بنية السوق)",
    };
  }
  return null;
}

/**
 * الصيغة الهيكلية للمضاربة: مستويات فعلية + حارس مضاعف المخاطرة.
 * تعيد null عند غياب ATR — فيسقط الحساب للصيغة الكلاسيكية.
 */
function buildStructured(
  strategy: StrategyKey,
  entry: number,
  t: TechnicalSnapshot
): { targets: RawTarget[]; stop: RawStop } | null {
  const atr = isPos(t.atr14) ? t.atr14 : null;
  if (atr === null) return null;

  // ١) الوقف يعرّف المخاطرة (1R): قاع متأرجح فعلي أولاً، وإلا وقف ATR
  // محكوم عند 1.5×ATR — لا نسقط أبداً لوقف SMA20 الكلاسيكي الذي قد يبعد
  // كثيراً فيقلب العائد/المخاطرة. المخاطرة تبقى ضمن [0.75, 2.5]×ATR دائماً.
  const stop: RawStop =
    structuralStop(entry, atr, t.swingLows) ?? {
      price: roundPrice(entry - 1.5 * atr),
      basisAr: "1.5× مدى الحركة اليومي ATR تحت الدخول (لا قاع متأرجح قريب صالح)",
    };
  if (!(stop.price > 0 && stop.price < entry)) return null;
  const risk = entry - stop.price;

  // ٢) مرشحات الأهداف: مستويات فعلية مرتبة تصاعدياً فوق الدخول
  const cands: RawTarget[] = [];
  for (const sh of t.swingHighs) {
    if (sh > entry) {
      cands.push({ price: sh, basisAr: "قمة متأرجحة سابقة (مقاومة بنية السوق)" });
    }
  }
  const piv = t.pivot;
  if (piv) {
    if (isPos(piv.r1) && piv.r1 > entry) cands.push({ price: piv.r1, basisAr: "المقاومة المحورية الأولى R1" });
    if (isPos(piv.r2) && piv.r2 > entry) cands.push({ price: piv.r2, basisAr: "المقاومة المحورية الثانية R2" });
    if (isPos(piv.r3) && piv.r3 > entry) cands.push({ price: piv.r3, basisAr: "المقاومة المحورية الثالثة R3" });
  }
  if (isPos(t.high50d) && t.high50d > entry) {
    cands.push({ price: t.high50d, basisAr: "قمة 50 يوماً" });
  }
  if (isPos(t.high52w) && t.high52w > entry) {
    cands.push({ price: t.high52w, basisAr: "قمة 52 أسبوعاً" });
  }
  cands.sort((a, b) => a.price - b.price);
  // إزالة المستويات المتلاصقة (أقرب من ربع ATR) — نبقي الأقرب للدخول
  const merged: RawTarget[] = [];
  for (const c of cands) {
    const last = merged[merged.length - 1];
    if (last && c.price - last.price < 0.25 * atr) continue;
    merged.push(c);
  }

  // ٣) اختيار الأهداف بحارس مضاعف المخاطرة (فوق حد أدنى يمنع أهدافاً صورية)
  const pickAbove = (floor: number): RawTarget | null =>
    merged.find((c) => c.price >= floor) ?? null;

  const t1Floor = entry + Math.max(risk, 0.5 * atr);
  const rawT1 =
    pickAbove(t1Floor) ??
    ({ price: entry + Math.max(risk, atr), basisAr: "مضاعف المخاطرة ×1 (لا مقاومة فعلية أقرب)" } as RawTarget);
  const t1: RawTarget = {
    price: rawT1.price,
    basisAr: `${rawT1.basisAr} — أول مستوى يحقق عائد/مخاطرة ≥ 1`,
  };

  const t2Floor = Math.max(t1.price + 0.5 * atr, entry + 2 * risk);
  const rawT2 =
    pickAbove(t2Floor) ??
    ({ price: entry + Math.max(2 * risk, 2 * atr), basisAr: "مضاعف المخاطرة ×2 (لا مقاومة فعلية أقرب)" } as RawTarget);
  const t2: RawTarget = {
    price: rawT2.price,
    basisAr: `${rawT2.basisAr} — يحقق عائد/مخاطرة ≥ 2`,
  };

  const t3Floor = t2.price + 0.5 * atr;
  const rawT3 =
    pickAbove(t3Floor) ??
    (isPos(t.high52w) && t.high52w > t3Floor
      ? ({ price: t.high52w, basisAr: "قمة 52 أسبوعاً" } as RawTarget)
      : ({ price: entry + Math.max(3 * risk, 3 * atr), basisAr: "مضاعف المخاطرة ×3 (امتداد الحركة)" } as RawTarget));

  return { targets: [t1, t2, rawT3], stop };
}

function buildLiquidity(
  entry: number,
  t: TechnicalSnapshot
): { targets: RawTarget[]; stop: RawStop } {
  const atr = isPos(t.atr14) ? t.atr14 : null;
  const r2 = t.pivot && isPos(t.pivot.r2) ? t.pivot.r2 : null;
  const s1 = t.pivot && isPos(t.pivot.s1) ? t.pivot.s1 : null;
  const h50 = isPos(t.high50d) ? t.high50d : null;

  const t1: RawTarget = atr
    ? { price: entry + atr, basisAr: "مدى الحركة اليومي ATR ×1 فوق سعر الدخول" }
    : { price: entry * 1.03, basisAr: "تقدير نسبي 3% لغياب مدى الحركة ATR" };
  const t2: RawTarget = atr
    ? { price: entry + 2 * atr, basisAr: "مدى الحركة اليومي ATR ×2 فوق سعر الدخول" }
    : { price: entry * 1.06, basisAr: "تقدير نسبي 6% لغياب مدى الحركة ATR" };

  let t3: RawTarget;
  if (r2 !== null && h50 !== null) {
    t3 =
      Math.min(r2, h50) === r2
        ? { price: r2, basisAr: "الأدنى من المقاومة المحورية R2 وقمة 50 يوماً (R2)" }
        : { price: h50, basisAr: "الأدنى من المقاومة المحورية R2 وقمة 50 يوماً (قمة 50 يوماً)" };
  } else if (r2 !== null) {
    t3 = { price: r2, basisAr: "المقاومة المحورية الثانية R2" };
  } else if (h50 !== null) {
    t3 = { price: h50, basisAr: "قمة 50 يوماً" };
  } else if (atr) {
    t3 = { price: entry + 3 * atr, basisAr: "مدى الحركة اليومي ATR ×3 لغياب المستويات المحورية" };
  } else {
    t3 = { price: entry * 1.09, basisAr: "تقدير نسبي 9% لغياب البيانات الفنية" };
  }

  const stop = pickStop(
    entry,
    [
      atr
        ? { price: entry - 1.5 * atr, basisAr: "1.5× مدى الحركة اليومي ATR تحت سعر الدخول" }
        : null,
      s1 !== null
        ? { price: s1 * 0.99, basisAr: "تحت الدعم المحوري الأول S1" }
        : null,
    ],
    { price: entry * 0.93, basisAr: "حماية افتراضية عند -7% لغياب البيانات الفنية" }
  );

  return { targets: [t1, t2, t3], stop };
}

function buildMomentum(
  entry: number,
  t: TechnicalSnapshot
): { targets: RawTarget[]; stop: RawStop } {
  const atr = isPos(t.atr14) ? t.atr14 : null;
  const piv = t.pivot;
  const r1 = piv && isPos(piv.r1) ? piv.r1 : null;
  const r2 = piv && isPos(piv.r2) ? piv.r2 : null;
  const r3 = piv && isPos(piv.r3) ? piv.r3 : null;
  const h52 = isPos(t.high52w) ? t.high52w : null;
  const sma20 = isPos(t.sma20) ? t.sma20 : null;

  const t1: RawTarget =
    r1 !== null
      ? { price: r1, basisAr: "المقاومة المحورية الأولى R1" }
      : atr
        ? { price: entry + atr, basisAr: "مدى الحركة اليومي ATR ×1 لغياب النقاط المحورية" }
        : { price: entry * 1.05, basisAr: "تقدير نسبي 5% لغياب البيانات الفنية" };

  const t2: RawTarget =
    r2 !== null
      ? { price: r2, basisAr: "المقاومة المحورية الثانية R2" }
      : atr
        ? { price: entry + 2 * atr, basisAr: "مدى الحركة اليومي ATR ×2 لغياب النقاط المحورية" }
        : { price: entry * 1.1, basisAr: "تقدير نسبي 10% لغياب البيانات الفنية" };

  let t3: RawTarget;
  if (h52 !== null && h52 > (r2 ?? entry)) {
    t3 = { price: h52, basisAr: "قمة 52 أسبوعاً" };
  } else if (r3 !== null) {
    t3 = { price: r3, basisAr: "المقاومة المحورية الثالثة R3" };
  } else if (atr) {
    t3 = { price: entry + 3 * atr, basisAr: "مدى الحركة اليومي ATR ×3 لغياب النقاط المحورية" };
  } else {
    t3 = { price: entry * 1.15, basisAr: "تقدير نسبي 15% لغياب البيانات الفنية" };
  }

  const stop = pickStop(
    entry,
    [
      sma20 !== null
        ? { price: sma20 * 0.99, basisAr: "أسفل المتوسط المتحرك 20 يوماً" }
        : null,
      atr
        ? { price: entry - 2 * atr, basisAr: "2× مدى الحركة اليومي ATR تحت سعر الدخول" }
        : null,
    ],
    { price: entry * 0.9, basisAr: "حماية افتراضية عند -10% لغياب البيانات الفنية" }
  );

  return { targets: [t1, t2, t3], stop };
}

/** الاتجاه العام من ترتيب السعر والمتوسطات */
function computeTrend(
  entry: number,
  t: TechnicalSnapshot
): { trend: Trend | null; trendAr: string | null } {
  const { sma20, sma50, sma200 } = t;
  let trend: Trend | null = null;

  if (sma50 !== null && sma200 !== null) {
    if (entry > sma50 && sma50 > sma200) trend = "UP";
    else if (entry < sma50 && sma50 < sma200) trend = "DOWN";
    else trend = "SIDEWAYS";
  } else if (sma20 !== null && sma50 !== null) {
    if (entry > sma20 && sma20 > sma50) trend = "UP";
    else if (entry < sma20 && sma20 < sma50) trend = "DOWN";
    else trend = "SIDEWAYS";
  }

  const trendAr =
    trend === "UP"
      ? "اتجاه صاعد"
      : trend === "DOWN"
        ? "اتجاه هابط"
        : trend === "SIDEWAYS"
          ? "اتجاه عرضي"
          : null;

  return { trend, trendAr };
}

/**
 * درجة الفرصة 0-100 — أوزان المكوّنات (المجموع 100):
 *   - الاتجاه: 40 نقطة (صاعد = 40، عرضي = 20، هابط = 0)
 *   - صحة RSI: 30 نقطة (كاملة داخل النطاق الصحي 40-65،
 *     وتتناقص خطياً إلى صفر عند 25 من الأسفل و80 من الأعلى)
 *   - القرب من قمة 50 يوماً: 30 نقطة (خطي: صفر عند 70% من القمة
 *     وكاملة عند القمة أو فوقها)
 *   - الحجم النسبي: غير مُمرَّر في توقيع الدالة بحسب العقد، فلا يدخل الحساب.
 * تُحسب الدرجة على المكوّنات المتاحة فقط ثم تُعاد إلى مقياس 0-100؛
 * إذا غابت كل المكوّنات فالنتيجة null.
 */
function computeScore(
  entry: number,
  t: TechnicalSnapshot,
  trend: Trend | null
): number | null {
  let earned = 0;
  let possible = 0;

  if (trend !== null) {
    possible += 40;
    earned += trend === "UP" ? 40 : trend === "SIDEWAYS" ? 20 : 0;
  }

  if (t.rsi14 !== null) {
    possible += 30;
    const rsi = t.rsi14;
    let frac = 0;
    if (rsi >= 40 && rsi <= 65) frac = 1;
    else if (rsi >= 25 && rsi < 40) frac = (rsi - 25) / 15;
    else if (rsi > 65 && rsi <= 80) frac = (80 - rsi) / 15;
    earned += 30 * frac;
  }

  if (isPos(t.high50d)) {
    possible += 30;
    const ratio = entry / t.high50d;
    const frac = Math.min(1, Math.max(0, (ratio - 0.7) / 0.3));
    earned += 30 * frac;
  }

  if (possible === 0) return null;
  return Math.min(100, Math.max(0, Math.round((earned / possible) * 100)));
}

/** جملة التوقع الآلي بالعربية من القيم المحسوبة فعلياً */
function buildExpectationAr(
  trend: Trend | null,
  rsi: number | null,
  targets: TargetLevel[],
  stop: number | null
): string {
  const trendPhrase =
    trend === "UP"
      ? "اتجاه صاعد فوق المتوسطات المتحركة"
      : trend === "DOWN"
        ? "اتجاه هابط دون المتوسطات المتحركة"
        : trend === "SIDEWAYS"
          ? "حركة عرضية حول المتوسطات المتحركة"
          : "بيانات الاتجاه غير كافية";

  let rsiPhrase = "";
  if (rsi !== null) {
    const r = Math.round(rsi);
    rsiPhrase =
      rsi < 30
        ? `، الزخم في تشبع بيعي (RSI ${r})`
        : rsi < 40
          ? `، الزخم ضعيف (RSI ${r})`
          : rsi <= 65
            ? `، الزخم صحي (RSI ${r})`
            : rsi <= 70
              ? `، الزخم مرتفع (RSI ${r})`
              : `، الزخم في تشبع شرائي (RSI ${r})`;
  }

  let scenario = "";
  if (targets.length >= 2) {
    scenario = ` السيناريو الإيجابي يستهدف ${fmtPrice(targets[0].price)} ثم ${fmtPrice(targets[1].price)}`;
  } else if (targets.length === 1) {
    scenario = ` السيناريو الإيجابي يستهدف ${fmtPrice(targets[0].price)}`;
  }
  if (scenario) {
    scenario +=
      stop !== null
        ? `، ويُلغى بالإغلاق دون ${fmtPrice(stop)}.`
        : ".";
  }

  return `${trendPhrase}${rsiPhrase}.${scenario}`;
}

/** الصيغة المعتمدة للعرض: الهيكلية دائماً (عائد/مخاطرة سليم قابل للتنفيذ) */
export function defaultFormulaFor(_strategy: StrategyKey): TargetFormula {
  return "structure";
}

export function computeTargets(
  strategy: StrategyKey,
  entry: number,
  tech: TechnicalSnapshot,
  analystTarget?: number | null,
  formula?: TargetFormula
): TargetsResult {
  const strategyAr = STRATEGY_NAMES_AR[strategy];

  // حارس: سعر دخول غير صالح → نتيجة فارغة آمنة
  if (!Number.isFinite(entry) || entry <= 0) {
    return {
      strategy,
      strategyAr,
      entry,
      stopLoss: null,
      stopLossBasisAr: null,
      targets: [],
      riskReward: null,
      trend: null,
      trendAr: null,
      score: null,
      expectationAr: "بيانات السعر غير صالحة لحساب الأهداف والتوقعات.",
      indicators: tech,
    };
  }

  const chosen = formula ?? defaultFormulaFor(strategy);
  let built: { targets: RawTarget[]; stop: RawStop };
  if (chosen === "structure") {
    // الهيكلية أولاً — وعند غياب ATR تسقط للصيغة الكلاسيكية تلقائياً
    built =
      buildStructured(strategy, entry, tech) ??
      (strategy === "liquidity"
        ? buildLiquidity(entry, tech)
        : buildMomentum(entry, tech));
  } else {
    // الكلاسيكية: الاتجاه يستعير منطق الزخم (مستويات محورية وقمم سنوية)
    built =
      strategy === "liquidity"
        ? buildLiquidity(entry, tech)
        : buildMomentum(entry, tech);
  }

  const targets = normalizeTargets(entry, built.targets);
  const stopLoss = built.stop.price;
  const stopLossBasisAr = built.stop.basisAr;

  // العائد/المخاطرة عند الهدف الأول — فقط عندما يكون الوقف تحت السعر
  let riskReward: number | null = null;
  if (
    targets.length > 0 &&
    stopLoss !== null &&
    stopLoss < entry &&
    entry - stopLoss > 1e-9
  ) {
    riskReward = round2((targets[0].price - entry) / (entry - stopLoss));
  }

  const { trend, trendAr } = computeTrend(entry, tech);
  const score = computeScore(entry, tech, trend);
  const expectationAr = buildExpectationAr(
    trend,
    tech.rsi14,
    targets,
    stopLoss
  );

  return {
    strategy,
    strategyAr,
    entry,
    stopLoss,
    stopLossBasisAr,
    targets,
    riskReward,
    trend,
    trendAr,
    score,
    expectationAr,
    indicators: tech,
  };
}
