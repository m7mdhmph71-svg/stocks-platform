// ============================================================
// الفحص الشرعي — تطبيق منهجية معيار أيوفي 21 على البيانات المالية.
// دالة نقية حتمية بلا أي جلب بيانات.
//
// الحكم:
//  - نشاط محرم أساساً → NON_COMPLIANT مباشرة.
//  - غياب القيمة السوقية أو إجمالي الدين كلياً → UNKNOWN.
//  - أي نسبة محسوبة تتجاوز حدها (30/30/5) → NON_COMPLIANT.
//  - تعذّر حساب نسبة الأوراق الربوية أو الدخل غير المباح → UNKNOWN.
//  - كل النسب ناجحة والدخل غير المباح ≈ 0 → COMPLIANT.
//  - النسب ناجحة مع دخل غير مباح ≤ 5% → MIXED (متوافق مع وجوب التطهير).
// ============================================================

import { Fundamentals, ShariahRatio, ShariahResult, ShariahVerdict } from "@/lib/types";
import { fmtCompact } from "@/lib/format";
import {
  ASSUMED_INTEREST_YIELD,
  DEBT_LIMIT_PCT,
  IMPURE_INCOME_LIMIT_PCT,
  IMPURE_NEGLIGIBLE_PCT,
  SECURITIES_LIMIT_PCT,
  checkBusinessActivity,
} from "@/lib/shariah/rules";

const METHODOLOGY_AR =
  "فحص تقديري اجتهادي وفق منهجية المعيار الشرعي رقم 21 الصادر عن هيئة المحاسبة والمراجعة للمؤسسات المالية الإسلامية (أيوفي): يُستبعد أولاً كل نشاط أساسي محرم (البنوك والتأمين التقليدي وخدمات الائتمان وإدارة الأصول الربوية، الخمور، التبغ، القمار والكازينوهات، الترفيه للبالغين، لحم الخنزير، القنّب، والتمويل العقاري الربوي)، ثم تُفحص ثلاث نسب مالية: إجمالي الدين الربوي إلى القيمة السوقية بحد أقصى 30%، والنقد مع الأوراق المالية الربوية إلى القيمة السوقية بحد أقصى 30%، والدخل غير المباح إلى إجمالي الإيراد بحد أقصى 5% مع وجوب تطهير ما يقابله من الأرباح. وحيث لا يفصح المصدر عن دخل الفوائد يُقدَّر تحفظياً بعائد افتراضي 4.5% على النقد والاستثمارات قصيرة الأجل. هذه النتيجة منهجية تقديرية مبنية على آخر القوائم المالية المتاحة من مصدر مجاني وقد لا تعكس أحدث البيانات، وهي اجتهاد آلي وليست فتوى شرعية، ولا تغني عن الرجوع إلى الهيئات الشرعية المعتمدة.";

const VERDICT_AR: Record<ShariahVerdict, string> = {
  COMPLIANT: "متوافق مع الضوابط الشرعية",
  MIXED: "متوافق مع وجوب التطهير",
  NON_COMPLIANT: "غير متوافق",
  UNKNOWN: "غير معروف — بيانات غير كافية",
};

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function buildRatios(f: Fundamentals | null): {
  ratios: ShariahRatio[];
  debtPct: number | null;
  secPct: number | null;
  impurePct: number | null;
  impureIncomeUsd: number | null;
} {
  const mcap =
    f && f.marketCap !== null && f.marketCap > 0 ? f.marketCap : null;

  // 1) الدين الربوي ÷ القيمة السوقية
  let debtPct: number | null = null;
  let debtDetail = "تعذّر الحساب: إجمالي الدين أو القيمة السوقية غير متوفر";
  if (f && f.totalDebt !== null && mcap !== null) {
    debtPct = (Math.max(0, f.totalDebt) / mcap) * 100;
    debtDetail = `إجمالي الدين ${fmtCompact(f.totalDebt)} ÷ القيمة السوقية ${fmtCompact(mcap)} — الحد الأقصى ${DEBT_LIMIT_PCT}%`;
  }

  // 2) (النقد + الأوراق المالية الربوية) ÷ القيمة السوقية
  let secPct: number | null = null;
  let secDetail =
    "تعذّر الحساب: النقد والاستثمارات أو القيمة السوقية غير متوفرة";
  const hasAnySecurities =
    f !== null &&
    (f.totalCash !== null ||
      f.shortTermInvestments !== null ||
      f.longTermInvestments !== null);
  if (f && hasAnySecurities && mcap !== null) {
    const total =
      Math.max(0, f.totalCash ?? 0) +
      Math.max(0, f.shortTermInvestments ?? 0) +
      Math.max(0, f.longTermInvestments ?? 0);
    secPct = (total / mcap) * 100;
    secDetail = `(النقد ${fmtCompact(f.totalCash)} + استثمارات قصيرة ${fmtCompact(f.shortTermInvestments)} + استثمارات طويلة ${fmtCompact(f.longTermInvestments)}) ÷ القيمة السوقية ${fmtCompact(mcap)} — الحد الأقصى ${SECURITIES_LIMIT_PCT}%`;
  }

  // 3) الدخل غير المباح ÷ إجمالي الإيراد
  let impurePct: number | null = null;
  let impureIncomeUsd: number | null = null;
  let impureDetail =
    "تعذّر الحساب: لا يتوفر دخل فوائد معلن ولا نقد وإيراد لتقديره";
  const rev =
    f && f.totalRevenue !== null && f.totalRevenue > 0 ? f.totalRevenue : null;
  if (f) {
    if (f.interestIncome !== null) {
      impureIncomeUsd = Math.max(0, f.interestIncome);
      if (rev !== null) {
        impurePct = (impureIncomeUsd / rev) * 100;
        impureDetail = `دخل الفوائد المعلن ${fmtCompact(impureIncomeUsd)} ÷ إجمالي الإيراد ${fmtCompact(rev)} — الحد الأقصى ${IMPURE_INCOME_LIMIT_PCT}%`;
      } else {
        impureDetail =
          "دخل الفوائد معلن لكن إجمالي الإيراد غير متوفر — تعذّر حساب النسبة";
      }
    } else if (f.totalCash !== null || f.shortTermInvestments !== null) {
      impureIncomeUsd =
        (Math.max(0, f.totalCash ?? 0) +
          Math.max(0, f.shortTermInvestments ?? 0)) *
        ASSUMED_INTEREST_YIELD;
      if (rev !== null) {
        impurePct = (impureIncomeUsd / rev) * 100;
        impureDetail = `تقدير تحفظي (وليس رقماً معلناً): (النقد + الاستثمارات قصيرة الأجل) × عائد فائدة افتراضي 4.5% = ${fmtCompact(impureIncomeUsd)} ÷ إجمالي الإيراد ${fmtCompact(rev)} — الحد الأقصى ${IMPURE_INCOME_LIMIT_PCT}%`;
      } else {
        impureDetail =
          "تقدير الدخل غير المباح ممكن لكن إجمالي الإيراد غير متوفر — تعذّر حساب النسبة";
      }
    }
  }

  const ratios: ShariahRatio[] = [
    {
      key: "debt",
      labelAr: "الدين الربوي إلى القيمة السوقية",
      value: debtPct === null ? null : round2(debtPct),
      limit: DEBT_LIMIT_PCT,
      pass: debtPct === null ? null : debtPct <= DEBT_LIMIT_PCT,
      detailAr: debtDetail,
    },
    {
      key: "interestSecurities",
      labelAr: "النقد والأوراق المالية الربوية إلى القيمة السوقية",
      value: secPct === null ? null : round2(secPct),
      limit: SECURITIES_LIMIT_PCT,
      pass: secPct === null ? null : secPct <= SECURITIES_LIMIT_PCT,
      detailAr: secDetail,
    },
    {
      key: "impureIncome",
      labelAr: "الدخل غير المباح إلى إجمالي الإيراد",
      value: impurePct === null ? null : round2(impurePct),
      limit: IMPURE_INCOME_LIMIT_PCT,
      pass: impurePct === null ? null : impurePct <= IMPURE_INCOME_LIMIT_PCT,
      detailAr: impureDetail,
    },
  ];

  return { ratios, debtPct, secPct, impurePct, impureIncomeUsd };
}

/** الفحص الشرعي الكامل لسهم واحد. f = null → UNKNOWN. */
export function screenShariah(f: Fundamentals | null): ShariahResult {
  const { ratios, debtPct, secPct, impurePct, impureIncomeUsd } =
    buildRatios(f);

  // نسبة التطهير ومبلغ التطهير لكل سهم — تُحسب حيثما أمكن بغض النظر عن الحكم.
  // تُسقَّف عند 100%: لا يُطهَّر أكثر من كامل الدخل (شركات بلا إيراد فعلي
  // قد يتجاوز دخل فوائدها إيرادها فتتضخم النسبة حسابياً).
  const purificationRatio =
    impurePct === null ? null : round2(Math.min(100, impurePct));
  const purificationPerShare =
    f !== null &&
    impureIncomeUsd !== null &&
    f.sharesOutstanding !== null &&
    f.sharesOutstanding > 0
      ? Math.round((impureIncomeUsd / f.sharesOutstanding) * 1e6) / 1e6
      : null;

  const base = {
    ratios,
    purificationRatio,
    purificationPerShare,
    methodologyAr: METHODOLOGY_AR,
    asOf: f?.asOf ?? null,
  };

  if (f === null) {
    return {
      verdict: "UNKNOWN",
      verdictAr: VERDICT_AR.UNKNOWN,
      businessCompliant: null,
      businessReasonAr: "تعذّر جلب البيانات المالية للشركة",
      ...base,
    };
  }

  const business = checkBusinessActivity(
    f.industry,
    f.sector,
    f.longBusinessSummary
  );

  // 1) نشاط محرم أساساً → غير متوافق مباشرة (بنوك/تأمين/خمور/قمار...)
  if (business.compliant === false) {
    return {
      verdict: "NON_COMPLIANT",
      verdictAr: VERDICT_AR.NON_COMPLIANT,
      businessCompliant: false,
      businessReasonAr: business.reasonAr,
      ...base,
    };
  }

  // 2) بيانات جوهرية مفقودة (القيمة السوقية أو إجمالي الدين) → غير معروف
  const mcapMissing = f.marketCap === null || !(f.marketCap > 0);
  if (mcapMissing || f.totalDebt === null || debtPct === null) {
    return {
      verdict: "UNKNOWN",
      verdictAr: VERDICT_AR.UNKNOWN,
      businessCompliant: business.compliant,
      businessReasonAr: business.reasonAr,
      ...base,
    };
  }

  // 3) أي نسبة محسوبة راسبة → غير متوافق
  const anyFail =
    debtPct > DEBT_LIMIT_PCT ||
    (secPct !== null && secPct > SECURITIES_LIMIT_PCT) ||
    (impurePct !== null && impurePct > IMPURE_INCOME_LIMIT_PCT);
  if (anyFail) {
    return {
      verdict: "NON_COMPLIANT",
      verdictAr: VERDICT_AR.NON_COMPLIANT,
      businessCompliant: business.compliant,
      businessReasonAr: business.reasonAr,
      ...base,
    };
  }

  // 4) تعذّر حساب إحدى النسبتين المتبقيتين → لا يمكن الجزم
  if (secPct === null || impurePct === null || business.compliant === null) {
    return {
      verdict: "UNKNOWN",
      verdictAr: VERDICT_AR.UNKNOWN,
      businessCompliant: business.compliant,
      businessReasonAr: business.reasonAr,
      ...base,
    };
  }

  // 5) كل النسب ناجحة: دخل غير مباح ≈ 0 → متوافق، وإلا مختلط مع التطهير
  const verdict: ShariahVerdict =
    impurePct < IMPURE_NEGLIGIBLE_PCT ? "COMPLIANT" : "MIXED";

  return {
    verdict,
    verdictAr: VERDICT_AR[verdict],
    businessCompliant: true,
    businessReasonAr: business.reasonAr,
    ...base,
  };
}
