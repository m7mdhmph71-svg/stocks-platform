// ============================================================
// قواعد الفحص الشرعي — منهجية المعيار الشرعي رقم 21 لهيئة المحاسبة
// والمراجعة للمؤسسات المالية الإسلامية (أيوفي / AAOIFI).
//
// فحص النشاط: قائمة سوداء لصناعات ياهو المحرّمة أساساً (بنوك وتأمين تقليدي
// وخدمات ائتمان وإدارة أصول ربوية وتمويل عقاري ربوي وصناديق REIT ربوية،
// خمور، تبغ، قمار وكازينوهات، ترفيه للبالغين، لحم خنزير، قنّب).
// الدفاع/الأسلحة تُعد مختلطة لا محرمة — غير مدرجة عمداً.
//
// النسب المالية (كلها ÷ القيمة السوقية والحد 30%، والدخل غير المباح ÷ الإيراد
// والحد 5%) — تُطبَّق في screen.ts. كل النتائج تقديرية اجتهادية وليست فتوى.
// ============================================================

/** الحد الأقصى لنسبة الدين الربوي إلى القيمة السوقية (%) */
export const DEBT_LIMIT_PCT = 30;

/** الحد الأقصى لنسبة النقد والأوراق المالية الربوية إلى القيمة السوقية (%) */
export const SECURITIES_LIMIT_PCT = 30;

/** الحد الأقصى لنسبة الدخل غير المباح إلى إجمالي الإيراد (%) */
export const IMPURE_INCOME_LIMIT_PCT = 5;

/**
 * عائد فائدة افتراضي تحفظي يُستخدم لتقدير دخل الفوائد عندما لا يفصح
 * المصدر عنه: (النقد + الاستثمارات قصيرة الأجل) × 4.5%
 */
export const ASSUMED_INTEREST_YIELD = 0.045;

/**
 * عتبة "الدخل غير المباح ≈ صفر" (%): دونها يُعد السهم متوافقاً نظيفاً
 * دون حاجة عملية للتطهير.
 */
export const IMPURE_NEGLIGIBLE_PCT = 0.05;

/**
 * صناعات ياهو المحرّمة أساساً — مطابقة نصية دقيقة (بعد تطبيع الشرطات).
 * المصدر: قيم summaryProfile.industry المعتادة في Yahoo Finance.
 */
export const HARAM_INDUSTRIES: readonly string[] = [
  // البنوك التقليدية والخدمات المالية الربوية
  "Banks—Diversified",
  "Banks—Regional",
  "Banks—Global",
  "Credit Services",
  "Asset Management",
  "Financial Conglomerates",
  "Mortgage Finance",
  // التأمين التقليدي
  "Insurance—Diversified",
  "Insurance—Life",
  "Insurance—Property & Casualty",
  "Insurance—Reinsurance",
  "Insurance—Specialty",
  "Insurance Brokers",
  // صناديق العقار الربوية
  "REIT—Mortgage",
  // الخمور
  "Beverages—Wineries & Distilleries",
  "Beverages—Brewers",
  // التبغ
  "Tobacco",
  // القمار والكازينوهات
  "Gambling",
  "Casinos & Gaming",
  "Resorts & Casinos",
];

/**
 * قواعد مطابقة جزئية احتياطية على اسم الصناعة (تغطي اختلافات صياغة ياهو
 * مثل "Banks - Regional" مقابل "Banks—Regional").
 * تنبيه: لا نستخدم /gaming/ وحدها كي لا تُصيب ألعاب الفيديو المباحة.
 */
export const HARAM_INDUSTRY_RULES: readonly {
  pattern: RegExp;
  reasonAr: string;
}[] = [
  { pattern: /bank/i, reasonAr: "بنك تقليدي قائم على الإقراض الربوي" },
  { pattern: /insurance/i, reasonAr: "تأمين تقليدي قائم على الغرر والربا" },
  { pattern: /credit services/i, reasonAr: "خدمات ائتمان ربوية" },
  { pattern: /asset management/i, reasonAr: "إدارة أصول ربوية" },
  { pattern: /financial conglomerate/i, reasonAr: "تكتل مالي ربوي" },
  { pattern: /mortgage/i, reasonAr: "تمويل عقاري ربوي (يشمل صناديق REIT الربوية)" },
  { pattern: /winer|distill|brewer/i, reasonAr: "إنتاج المشروبات الكحولية" },
  { pattern: /tobacco/i, reasonAr: "صناعة التبغ" },
  { pattern: /casino|gambl/i, reasonAr: "القمار والكازينوهات" },
];

/**
 * كلمات مفتاحية في وصف نشاط الشركة (longBusinessSummary) تدل على نشاط
 * أساسي محرم — فحص نصي احتياطي عندما لا تكشفه الصناعة.
 */
export const HARAM_SUMMARY_RULES: readonly {
  pattern: RegExp;
  reasonAr: string;
}[] = [
  { pattern: /\bpork\b|\bswine\b/i, reasonAr: "منتجات لحم الخنزير" },
  {
    pattern:
      /alcoholic beverage|\bliquor\b|\bbrewer(y|ies)?\b|\bbrewing\b|winer(y|ies)|distiller|\bvodka\b|whisk(e)?y\b/i,
    reasonAr: "إنتاج أو توزيع المشروبات الكحولية",
  },
  {
    pattern: /\bgambling\b|\bcasinos?\b|sports betting|\bwagering\b|lotter(y|ies)/i,
    reasonAr: "القمار والمراهنات",
  },
  { pattern: /\bcannabis\b|\bmarijuana\b/i, reasonAr: "منتجات القنّب" },
  { pattern: /adult entertainment/i, reasonAr: "الترفيه للبالغين" },
];

/** تطبيع اسم الصناعة للمقارنة الدقيقة: حروف صغيرة وشرطات موحّدة */
function normalizeIndustry(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[—–-]+\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_HARAM_INDUSTRIES = new Set(
  HARAM_INDUSTRIES.map(normalizeIndustry)
);

export interface BusinessCheck {
  /** true مباح، false محرم أساساً، null بيانات غير كافية */
  compliant: boolean | null;
  reasonAr: string | null;
}

/**
 * فحص النشاط الأساسي: مطابقة دقيقة على قائمة الصناعات، ثم مطابقة جزئية
 * احتياطية، ثم فحص نصي لوصف الشركة. دالة نقية حتمية.
 */
export function checkBusinessActivity(
  industry: string | null,
  sector: string | null,
  longBusinessSummary: string | null
): BusinessCheck {
  const ind = industry ?? "";
  const sec = sector ?? "";
  const summary = longBusinessSummary ?? "";

  if (ind) {
    if (NORMALIZED_HARAM_INDUSTRIES.has(normalizeIndustry(ind))) {
      const rule = HARAM_INDUSTRY_RULES.find((r) => r.pattern.test(ind));
      return {
        compliant: false,
        reasonAr: `${rule ? rule.reasonAr : "الصناعة ضمن قائمة الأنشطة المحرمة"} (${ind})`,
      };
    }
    for (const rule of HARAM_INDUSTRY_RULES) {
      if (rule.pattern.test(ind)) {
        return { compliant: false, reasonAr: `${rule.reasonAr} (${ind})` };
      }
    }
  }

  if (summary) {
    for (const rule of HARAM_SUMMARY_RULES) {
      if (rule.pattern.test(summary)) {
        return {
          compliant: false,
          reasonAr: `ورد في وصف نشاط الشركة ما يدل على: ${rule.reasonAr}`,
        };
      }
    }
  }

  if (!ind && !sec && !summary) {
    return {
      compliant: null,
      reasonAr: "لا تتوفر بيانات كافية عن نشاط الشركة",
    };
  }

  return {
    compliant: true,
    reasonAr: "لم يُرصد نشاط محرم أساسي في صناعة الشركة أو وصف أعمالها",
  };
}
