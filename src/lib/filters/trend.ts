// استراتيجية «الاتجاه الصاعد» — منهج القوة الموثق (أونيل/مينرفيني):
// اشترِ القوي في اتجاه صاعد مؤكد قرب قممه، لا الرخيص المرتد من قيعانه.
// أكثر المناهج توثيقاً في أدبيات التداول (أثر الزخم متوسط المدى) وأكثرها
// استقراراً عبر الأسواق — وهي عكس فلسفة فلاتر المضاربة (قفزات اليوم).
//
// شروطها الفنية (بوابة passesTrendTechnicals على شموع سنة):
//   1) السعر فوق SMA200 وSMA50 فوق SMA200 — هيكل اتجاه صاعد قائم.
//   2) السعر ضمن 15% من قمة 52 أسبوعاً — قرب القمم لا قرب القيعان.
//   3) السعر أعلى بـ 25% على الأقل من قاع 52 أسبوعاً — خرج فعلاً من القاع.
//   4) أداء الشهر موجب — الزخم مستمر لا متلاشٍ.
//   5) RSI ≤ 80 — ليس في ذروة تمدد لحظة الدخول.
//
// الكون الخشن (يفوَّض لفرز ياهو): سعر ≥ 5$، متوسط حجم ≥ 500 ألف،
// قيمة سوقية ≥ 300 مليون — جودة وسيولة، لا أسهم هللات.

import { FilterCondition, TechnicalSnapshot } from "@/lib/types";

export interface TrendPreset {
  key: "trend";
  nameAr: string;
  taglineAr: string;
  descriptionAr: string;
  conditions: FilterCondition[];
  advancedNotesAr: string[];
}

export const TREND_PRESET: TrendPreset = {
  key: "trend",
  nameAr: "الاتجاه الصاعد",
  taglineAr: "اشترِ القوة لا الرخص",
  descriptionAr:
    "المنهج الأكثر توثيقاً في أدبيات التداول: أسهم جودة سائلة في اتجاه " +
    "صاعد مؤكد (فوق متوسط 200 يوم)، قريبة من قمم 52 أسبوعاً وبعيدة عن " +
    "قيعانها، بزخم شهري مستمر — تُشترى القوة عند تماسكها لا الضعف عند " +
    "انهياره. الأهداف والأوقاف بصيغة بنية السوق (وقف تحت آخر قاع متأرجح).",
  conditions: [
    { field: "price", op: "gte", value: 5 },
    { field: "avgVolume3m", op: "gte", value: 500_000 },
    { field: "marketCap", op: "gte", value: 300_000_000 },
  ],
  advancedNotesAr: [
    "بوابة فنية بعد الفرز الخشن: فوق SMA200، وSMA50 فوق SMA200، وضمن 15% من قمة 52 أسبوعاً، وفوق قاع 52 أسبوعاً بـ 25%+، وأداء شهري موجب، وRSI ≤ 80.",
    "الخروج الأمثل تجريبياً لهذه الاستراتيجية (مقارنة 120 جلسة): وقف متحرك (أعلى قمة − 3×ATR) بمعامل ربح 1.41، أو نصف الكمية عند الهدف الأول والباقي متحرك (1.36) — لا تقطف ربح الاتجاه مبكراً، عكس أسهم المضاربة تماماً.",
    "أفق الصفقة أطول من فلاتر المضاربة (أسابيع لا جلسات) — أفق الاختبار التاريخي لها 30 جلسة.",
    "المنهج مبني على أثر الزخم متوسط المدى الموثق أكاديمياً (Jegadeesh & Titman) ومنهجيات O'Neil/Minervini العملية.",
  ],
};

export interface TrendGate {
  pass: boolean;
  failsAr: string[];
}

/** البوابة الفنية للاتجاه الصاعد — تعمل على TechnicalSnapshot من شموع سنة */
export function passesTrendTechnicals(
  price: number,
  t: TechnicalSnapshot
): TrendGate {
  const failsAr: string[] = [];

  if (t.sma200 === null || t.sma50 === null) {
    failsAr.push("تاريخ غير كافٍ لمتوسط 200 يوم");
  } else {
    if (price <= t.sma200) failsAr.push("السعر تحت متوسط 200 يوم");
    if (t.sma50 <= t.sma200) failsAr.push("متوسط 50 تحت متوسط 200 (لا هيكل صاعد)");
  }

  if (t.high52w === null || t.low52w === null) {
    failsAr.push("لا بيانات قمة/قاع 52 أسبوعاً");
  } else {
    if (price < 0.85 * t.high52w) failsAr.push("أبعد من 15% عن قمة 52 أسبوعاً");
    if (price < 1.25 * t.low52w) failsAr.push("لم يرتفع 25% عن قاع 52 أسبوعاً");
  }

  if (t.monthPerfPercent === null || t.monthPerfPercent <= 0) {
    failsAr.push("أداء الشهر غير موجب");
  }
  if (t.rsi14 !== null && t.rsi14 > 80) {
    failsAr.push("RSI في ذروة تمدد (> 80)");
  }

  return { pass: failsAr.length === 0, failsAr };
}
