// ============================================================
// شروط فلتر الاستثمار طويل المدى التي تُقيَّم بعد الإثراء
// (أساسية من Fundamentals وفنية من TechnicalSnapshot).
// دوال نقية حتمية — الحقل الغائب (null) يُعدّ راسباً مع سبب عربي واضح.
//
// حدود بيانات ياهو المجانية (موثّقة في advancedNotesAr):
//  - نمو 5 سنوات (fa_eps5years_pos / fa_sales5years_pos) مُقرَّب باتجاه
//    آخر 4 سنوات متاحة من netIncomeHistory / revenueHistory.
//  - العائد على الاستثمار ROI (fa_roi_o10) مُقرَّب بالعائد على حقوق الملكية ROE.
// ============================================================

import { Fundamentals, TechnicalSnapshot } from "@/lib/types";
import { fmtNum } from "@/lib/format";

export interface LongtermCheck {
  pass: boolean;
  failsAr: string[];
}

/**
 * تقريب "نمو موجب على المدى الطويل" من سلسلة سنوية (الأقدم أولاً):
 * آخر قيمة أعلى من أول قيمة، وآخر قيمة موجبة.
 * يعيد null عندما تكون السلسلة أقصر من نقطتين.
 */
function positiveTrend(series: number[]): boolean | null {
  const clean = series.filter((x) => Number.isFinite(x));
  if (clean.length < 2) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  return last > first && last > 0;
}

/**
 * الشروط الأساسية لفلتر الاستثمار طويل المدى:
 * currentRatio > 1، debtToEquity < 1، اتجاه صافي الدخل موجب (تقريب نمو 5 سنوات)،
 * earningsGrowthYoY > 5%، epsGrowthNextYear > 0، grossMargins > 0،
 * trailingPE موجب وأقل من 25، returnOnEquity > 10% (تقريب ROI)،
 * اتجاه الإيرادات موجب (تقريب نمو مبيعات 5 سنوات).
 */
export function passesLongtermFundamentals(f: Fundamentals): LongtermCheck {
  const failsAr: string[] = [];

  // نسبة التداول > 1
  if (f.currentRatio === null) {
    failsAr.push("نسبة التداول غير متوفرة");
  } else if (!(f.currentRatio > 1)) {
    failsAr.push(`نسبة التداول (${fmtNum(f.currentRatio)}) ليست أعلى من 1`);
  }

  // الدين / حقوق الملكية < 1
  if (f.debtToEquity === null) {
    failsAr.push("نسبة الدين إلى حقوق الملكية غير متوفرة");
  } else if (!(f.debtToEquity < 1)) {
    failsAr.push(
      `نسبة الدين إلى حقوق الملكية (${fmtNum(f.debtToEquity)}) ليست أقل من 1`
    );
  }

  // نمو ربحية 5 سنوات موجب — تقريب: اتجاه صافي الدخل
  const niTrend = positiveTrend(f.netIncomeHistory);
  if (niTrend === null) {
    failsAr.push(
      "تاريخ صافي الدخل غير كافٍ لتقدير نمو الربحية (تقريب نمو 5 سنوات)"
    );
  } else if (!niTrend) {
    failsAr.push(
      "اتجاه صافي الدخل غير موجب (تقريب نمو ربحية 5 سنوات من آخر 4 سنوات متاحة)"
    );
  }

  // نمو الربحية السنوي > 5%
  if (f.earningsGrowthYoY === null) {
    failsAr.push("نمو الربحية السنوي غير متوفر");
  } else if (!(f.earningsGrowthYoY > 0.05)) {
    failsAr.push(
      `نمو الربحية السنوي (${fmtNum(f.earningsGrowthYoY * 100)}%) ليس أعلى من 5%`
    );
  }

  // نمو الربحية المتوقع للسنة القادمة > 0
  if (f.epsGrowthNextYear === null) {
    failsAr.push("توقع نمو ربحية السنة القادمة غير متوفر");
  } else if (!(f.epsGrowthNextYear > 0)) {
    failsAr.push(
      `توقع نمو ربحية السنة القادمة (${fmtNum(f.epsGrowthNextYear * 100)}%) غير موجب`
    );
  }

  // هامش الربح الإجمالي > 0
  if (f.grossMargins === null) {
    failsAr.push("هامش الربح الإجمالي غير متوفر");
  } else if (!(f.grossMargins > 0)) {
    failsAr.push(
      `هامش الربح الإجمالي (${fmtNum(f.grossMargins * 100)}%) غير موجب`
    );
  }

  // مكرر الربحية موجب وأقل من 25
  if (f.trailingPE === null) {
    failsAr.push("مكرر الربحية غير متوفر");
  } else if (!(f.trailingPE > 0 && f.trailingPE < 25)) {
    failsAr.push(
      `مكرر الربحية (${fmtNum(f.trailingPE)}) ليس موجباً وأقل من 25`
    );
  }

  // العائد على حقوق الملكية > 10% (أقرب متاح لـ ROI)
  if (f.returnOnEquity === null) {
    failsAr.push("العائد على حقوق الملكية (تقريب ROI) غير متوفر");
  } else if (!(f.returnOnEquity > 0.1)) {
    failsAr.push(
      `العائد على حقوق الملكية (${fmtNum(f.returnOnEquity * 100)}%) ليس أعلى من 10% (تقريب ROI)`
    );
  }

  // نمو مبيعات 5 سنوات موجب — تقريب: اتجاه الإيرادات
  const revTrend = positiveTrend(f.revenueHistory);
  if (revTrend === null) {
    failsAr.push(
      "تاريخ الإيرادات غير كافٍ لتقدير نمو المبيعات (تقريب نمو 5 سنوات)"
    );
  } else if (!revTrend) {
    failsAr.push(
      "اتجاه الإيرادات غير موجب (تقريب نمو مبيعات 5 سنوات من آخر 4 سنوات متاحة)"
    );
  }

  return { pass: failsAr.length === 0, failsAr };
}

/**
 * الشروط الفنية لفلتر الاستثمار طويل المدى:
 * السعر ضمن 10% من قمة 50 يوماً، RSI14 ≤ 60، السعر فوق SMA200.
 */
export function passesLongtermTechnicals(
  price: number,
  t: TechnicalSnapshot
): LongtermCheck {
  const failsAr: string[] = [];

  if (!Number.isFinite(price) || price <= 0) {
    failsAr.push("سعر السهم غير صالح للتقييم الفني");
    return { pass: false, failsAr };
  }

  // ضمن 10% من قمة 50 يوماً
  if (t.high50d === null || !(t.high50d > 0)) {
    failsAr.push("قمة 50 يوماً غير متوفرة");
  } else if (!(price >= t.high50d * 0.9)) {
    failsAr.push(
      `السعر (${fmtNum(price)}) ليس ضمن 10% من قمة 50 يوماً (${fmtNum(t.high50d)})`
    );
  }

  // RSI14 ≤ 60
  if (t.rsi14 === null) {
    failsAr.push("مؤشر القوة النسبية RSI غير متوفر");
  } else if (!(t.rsi14 <= 60)) {
    failsAr.push(`مؤشر القوة النسبية RSI (${fmtNum(t.rsi14, 0)}) أعلى من 60`);
  }

  // السعر فوق المتوسط المتحرك 200 يوم
  if (t.sma200 === null) {
    failsAr.push("المتوسط المتحرك 200 يوم غير متوفر");
  } else if (!(price > t.sma200)) {
    failsAr.push(
      `السعر (${fmtNum(price)}) ليس فوق المتوسط المتحرك 200 يوم (${fmtNum(t.sma200)})`
    );
  }

  return { pass: failsAr.length === 0, failsAr };
}
