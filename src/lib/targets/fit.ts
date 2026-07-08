// محرك ملاءمة السهم للاستراتيجية — يجيب عن سؤال المستخدم الأول:
// «أي خطة تناسب هذا السهم؟» بدل عرض أربع خطط متساوية لكل سهم.
//
// المبدأ: لكل استراتيجية نطاق أسهم صريح (سعر/حجم/بنية فنية). السهم
// الخارج عن النطاق تُعرض خطته للاطلاع فقط بوسم «غير ملائمة» وبلا
// «درجة فرصة» — فلا يظهر أبداً «99/100» لسهم ضخم على فلتر مضاربة خاطفة.
// دوال نقية حتمية بلا أي جلب بيانات.

import { StrategyKey, TechnicalSnapshot } from "@/lib/types";

export type FitLevel = "good" | "partial" | "poor";

export interface StrategyFitInfo {
  level: FitLevel;
  reasonAr: string;
}

export interface StockFit {
  /** الاستراتيجية الملائمة المقترحة — null إن لم تلائمه أي خطة شراء الآن */
  recommended: StrategyKey | null;
  /** أقرب استراتيجية للعرض الافتراضي (تُملأ دائماً) */
  closest: StrategyKey;
  /** جملة التصنيف الموجزة (سبب الترشيح أو سبب عدم الملاءمة) */
  reasonAr: string;
  perStrategy: Record<StrategyKey, StrategyFitInfo>;
}

export interface FitInput {
  price: number;
  marketCap: number | null;
  floatShares: number | null;
  volume: number | null;
  avgVolume3m: number | null;
  relativeVolume: number | null;
  /** سهم سوق تداول (.SR) */
  isSaudi: boolean;
  tech: TechnicalSnapshot;
}

const M = 1_000_000;

export function classifyStockFit(x: FitInput): StockFit {
  const { price, tech } = x;
  const vol = x.volume ?? x.avgVolume3m;

  // — بنية الاتجاه المشتركة —
  const aboveSma200 =
    tech.sma200 !== null && price > tech.sma200;
  const bullStructure =
    aboveSma200 && tech.sma50 !== null && tech.sma200 !== null && tech.sma50 > tech.sma200;
  const nearHigh52 =
    tech.high52w !== null && price >= 0.85 * tech.high52w;
  const offLow52 =
    tech.low52w !== null && price >= 1.25 * tech.low52w;

  // ————— صيد السيولة (مضاربة خاطفة: 1-10$، أسهم حرة قليلة، سيولة لحظية) —————
  let liquidity: StrategyFitInfo;
  if (x.isSaudi) {
    liquidity = {
      level: "poor",
      reasonAr: "بيانات الأسهم الحرة غير متاحة بدقة لأسهم تداول",
    };
  } else if (price < 1 || price > 10) {
    liquidity = {
      level: "poor",
      reasonAr: "سعره خارج نطاق المضاربة الخاطفة (1-10$)",
    };
  } else if (x.floatShares !== null && x.floatShares >= 50 * M) {
    liquidity = {
      level: "poor",
      reasonAr: "أسهمه الحرة كثيرة (≥ 50 مليوناً) — لا يتحرك حركة الأسهم الخاطفة",
    };
  } else if (vol !== null && vol > 500_000) {
    liquidity = { level: "good", reasonAr: "سعر وحجم وأسهم حرة في نطاق المضاربة الخاطفة" };
  } else {
    liquidity = { level: "partial", reasonAr: "في النطاق السعري لكن سيولته اليوم متواضعة" };
  }

  // ————— الزخم / السوينق (1-10$ بحجم نسبي مرتفع) —————
  let momentum: StrategyFitInfo;
  if (x.isSaudi) {
    // زخم تداول: نشاط أعلى من المعتاد
    if (x.relativeVolume !== null && x.relativeVolume >= 1.2 && (vol ?? 0) >= 100_000) {
      momentum = { level: "good", reasonAr: "نشاط تداول أعلى من معتاده" };
    } else {
      momentum = { level: "partial", reasonAr: "لا نشاط استثنائياً اليوم — راقب الحجم النسبي" };
    }
  } else if (price < 1 || price > 10) {
    momentum = {
      level: "poor",
      reasonAr: "سعره خارج نطاق أسهم الزخم الخاطف (1-10$)",
    };
  } else if ((vol ?? 0) > 500_000 && (x.relativeVolume ?? 0) > 1) {
    momentum = { level: "good", reasonAr: "سعر وحجم نسبي في نطاق موجات الزخم" };
  } else {
    momentum = { level: "partial", reasonAr: "في النطاق السعري لكن دون حجم نسبي مؤكد" };
  }

  // ————— الاتجاه الصاعد (جودة سائلة قرب قممها) —————
  const qualitySize =
    price >= 5 && (x.marketCap === null || x.marketCap >= 300 * M);
  let trend: StrategyFitInfo;
  if (!qualitySize) {
    trend = {
      level: "poor",
      reasonAr: "خارج كون الجودة (سعر ≥ 5 وقيمة سوقية ≥ 300 مليون)",
    };
  } else if (tech.sma200 === null) {
    trend = { level: "partial", reasonAr: "تاريخه أقصر من متوسط 200 يوم — لا يمكن تأكيد الاتجاه" };
  } else if (!aboveSma200) {
    trend = { level: "poor", reasonAr: "تحت متوسط 200 يوم — لا هيكل صاعد قائماً" };
  } else if (bullStructure && nearHigh52 && offLow52) {
    trend = { level: "good", reasonAr: "اتجاه صاعد مؤكد قرب قمم 52 أسبوعاً" };
  } else {
    trend = {
      level: "partial",
      reasonAr: "فوق متوسط 200 يوم لكنه بعيد عن قممه — انتظر اقترابه من قمة جديدة",
    };
  }

  // ————— الاستثمار طويل المدى (جودة + اتجاه سليم) —————
  let longterm: StrategyFitInfo;
  if (!qualitySize || (x.avgVolume3m !== null && x.avgVolume3m < 100_000)) {
    longterm = {
      level: "poor",
      reasonAr: "صغير أو ضعيف السيولة — خارج كون الاستثمار",
    };
  } else if (aboveSma200) {
    longterm = { level: "good", reasonAr: "شركة كبيرة سائلة في اتجاه طويل سليم" };
  } else {
    longterm = {
      level: "partial",
      reasonAr: "جودة لكنه في مرحلة هبوط — للمراقبة لا للدخول الفوري",
    };
  }

  const perStrategy: Record<StrategyKey, StrategyFitInfo> = {
    liquidity,
    momentum,
    trend,
    longterm,
  };

  // — الترشيح: مضاربة أولاً لأسهمها، ثم الاتجاه، ثم الاستثمار —
  const priority: StrategyKey[] = x.isSaudi
    ? ["trend", "momentum", "longterm", "liquidity"]
    : price <= 10
      ? ["momentum", "liquidity", "trend", "longterm"]
      : ["trend", "longterm", "momentum", "liquidity"];

  const recommended =
    priority.find((k) => perStrategy[k].level === "good") ?? null;
  const closest =
    recommended ??
    priority.find((k) => perStrategy[k].level === "partial") ??
    "longterm";

  const reasonAr = recommended
    ? perStrategy[recommended].reasonAr
    : perStrategy[closest].level === "partial"
      ? `لا ملاءمة مؤكدة الآن — الأقرب «جزئياً»: ${perStrategy[closest].reasonAr}`
      : "لا نرى خطة شراء ملائمة لهذا السهم حالياً — الخطط معروضة للاطلاع فقط";

  return { recommended, closest, reasonAr, perStrategy };
}
