// ============================================================
// الفلاتر الجاهزة الثلاثة — مطابقة حرفياً لفلاتر Finviz التي حدّدها المستخدم.
// لا تغيّر finvizQuery ولا legend ولا العتبات الرقمية — إنها عقد ملزم.
// ============================================================

import { ScreenerPreset, StrategyKey } from "@/lib/types";

/** أسماء الاستراتيجيات بالعربية — تُستخدم في الواجهة ومحرك الأهداف */
export const STRATEGY_NAMES_AR: Record<StrategyKey, string> = {
  liquidity: "صيد السيولة",
  momentum: "الزخم / السوينق",
  longterm: "الاستثمار طويل المدى",
};

export const PRESETS: Record<StrategyKey, ScreenerPreset> = {
  // ------------------------------------------------------------
  // 1) صيد السيولة — مضاربة قصيرة
  // ------------------------------------------------------------
  liquidity: {
    key: "liquidity",
    nameAr: "صيد السيولة",
    taglineAr: "مضاربة قصيرة",
    descriptionAr:
      "أسهم منخفضة السعر بأسهم حرة قليلة وسيولة لحظية مرتفعة، مع اندفاع قوي من افتتاح اليوم دون تطرف في تغير اليوم الكامل — فرص مضاربة سريعة عالية المخاطر داخل الجلسة.",
    finvizQuery:
      "sh_curvol_o500,sh_float_u50,sh_price_1to10,ta_changeopen_u10,ta_perf_10to-i10",
    legend: [
      { code: "sh_curvol_o500", meaningAr: "الحجم الحالي أعلى من 500 ألف" },
      { code: "sh_float_u50", meaningAr: "الأسهم الحرة أقل من 50 مليون" },
      { code: "sh_price_1to10", meaningAr: "السعر بين 1 و 10 دولار" },
      { code: "ta_changeopen_u10", meaningAr: "التغير من الافتتاح أعلى من 10%" },
      { code: "ta_perf_10to-i10", meaningAr: "أداء اليوم بين -10% و +10%" },
    ],
    conditions: [
      { field: "volume", op: "gt", value: 500000 },
      { field: "floatShares", op: "lt", value: 50000000 },
      { field: "price", op: "btwn", value: [1, 10] },
      { field: "changeFromOpenPercent", op: "gt", value: 10 },
      { field: "changePercent", op: "btwn", value: [-10, 10] },
    ],
    advancedNotesAr: [
      "شرط الأسهم الحرة يُقيَّم بعد إثراء البيانات الأساسية من ياهو، لأن الفرز الخشن لا يوفر عدد الأسهم الحرة مباشرة.",
    ],
  },

  // ------------------------------------------------------------
  // 2) الزخم / السوينق
  // ------------------------------------------------------------
  momentum: {
    key: "momentum",
    nameAr: "الزخم / السوينق",
    taglineAr: "ركوب موجة الزخم لأيام إلى أسابيع",
    descriptionAr:
      "أسهم منخفضة السعر بسيولة نسبية أعلى من المعتاد وزخم أسبوعي قوي، مع دفعة إيجابية من افتتاح اليوم — مرشّحة لاستمرار الحركة على مدى أيام (سوينق).",
    finvizQuery:
      "sh_curvol_o500,sh_float_o20,sh_price_1to10,sh_relvol_o1,ta_changeopen_u5,ta_perf_1w10o",
    legend: [
      { code: "sh_curvol_o500", meaningAr: "الحجم الحالي أعلى من 500 ألف" },
      { code: "sh_float_o20", meaningAr: "الأسهم الحرة أعلى من 20 مليون" },
      { code: "sh_price_1to10", meaningAr: "السعر بين 1 و 10 دولار" },
      { code: "sh_relvol_o1", meaningAr: "الحجم النسبي أعلى من 1" },
      { code: "ta_changeopen_u5", meaningAr: "التغير من الافتتاح أعلى من 5%" },
      { code: "ta_perf_1w10o", meaningAr: "أداء الأسبوع أعلى من 10%" },
    ],
    conditions: [
      { field: "volume", op: "gt", value: 500000 },
      { field: "floatShares", op: "gt", value: 20000000 },
      { field: "price", op: "btwn", value: [1, 10] },
      { field: "relativeVolume", op: "gt", value: 1 },
      { field: "changeFromOpenPercent", op: "gt", value: 5 },
      { field: "weekPerfPercent", op: "gt", value: 10 },
    ],
    advancedNotesAr: [
      "شرط أداء الأسبوع يُقيَّم بعد إثراء بيانات التاريخ السعري (آخر 5 جلسات)، وشرط الأسهم الحرة بعد إثراء البيانات الأساسية.",
    ],
  },

  // ------------------------------------------------------------
  // 3) الاستثمار طويل المدى
  // ------------------------------------------------------------
  longterm: {
    key: "longterm",
    nameAr: "الاستثمار طويل المدى",
    taglineAr: "جودة مالية واتجاه صاعد راسخ",
    descriptionAr:
      "شركات أمريكية متوسطة فأكبر ذات ملاءة مالية جيدة ونمو مستمر في الأرباح والمبيعات، بتقييم معقول واتجاه فني صاعد فوق المتوسط 200 يوم دون تشبع شرائي — مرشّحة للاستثمار طويل المدى.",
    finvizQuery:
      "cap_smallover,fa_curratio_o1,fa_debteq_u1,fa_eps5years_pos,fa_epsyoy_o5,fa_epsyoy1_pos,fa_grossmargin_pos,fa_pe_u25,fa_roi_o10,fa_sales5years_pos,geo_usa,sh_avgvol_o500,sh_float_o50,sh_price_o5,ta_highlow50d_a10h,ta_rsi_nob60,ta_sma200_pa",
    legend: [
      { code: "cap_smallover", meaningAr: "القيمة السوقية صغيرة فما فوق (300 مليون دولار فأكثر)" },
      { code: "fa_curratio_o1", meaningAr: "نسبة التداول أعلى من 1" },
      { code: "fa_debteq_u1", meaningAr: "الدين إلى حقوق الملكية أقل من 1" },
      { code: "fa_eps5years_pos", meaningAr: "نمو ربحية السهم خلال 5 سنوات موجب" },
      { code: "fa_epsyoy_o5", meaningAr: "نمو ربحية السهم السنوي أعلى من 5%" },
      { code: "fa_epsyoy1_pos", meaningAr: "نمو ربحية السهم المتوقع للسنة القادمة موجب" },
      { code: "fa_grossmargin_pos", meaningAr: "هامش الربح الإجمالي موجب" },
      { code: "fa_pe_u25", meaningAr: "مكرر الربحية أقل من 25" },
      { code: "fa_roi_o10", meaningAr: "العائد على الاستثمار أعلى من 10%" },
      { code: "fa_sales5years_pos", meaningAr: "نمو المبيعات خلال 5 سنوات موجب" },
      { code: "geo_usa", meaningAr: "شركات مقرها الولايات المتحدة" },
      { code: "sh_avgvol_o500", meaningAr: "متوسط حجم التداول أعلى من 500 ألف" },
      { code: "sh_float_o50", meaningAr: "الأسهم الحرة أعلى من 50 مليون" },
      { code: "sh_price_o5", meaningAr: "السعر أعلى من 5 دولارات" },
      { code: "ta_highlow50d_a10h", meaningAr: "السعر ضمن 10% من قمة 50 يوماً" },
      { code: "ta_rsi_nob60", meaningAr: "مؤشر القوة النسبية RSI ليس أعلى من 60" },
      { code: "ta_sma200_pa", meaningAr: "السعر فوق المتوسط المتحرك 200 يوم" },
    ],
    conditions: [
      { field: "marketCap", op: "gte", value: 300000000 },
      { field: "avgVolume3m", op: "gt", value: 500000 },
      { field: "floatShares", op: "gt", value: 50000000 },
      { field: "price", op: "gt", value: 5 },
    ],
    advancedNotesAr: [
      "الشروط الأساسية والفنية (نسبة التداول، المديونية، النمو، مكرر الربحية، RSI، المتوسط 200 يوم، قمة 50 يوماً) تُقيَّم في الخادم بعد إثراء البيانات، وليست ضمن الشروط المحلية العادية.",
      "نمو 5 سنوات مُقرَّب من آخر 4 سنوات متاحة في بيانات ياهو المجانية (اتجاه صافي الدخل والإيرادات).",
      "العائد على الاستثمار ROI مُقرَّب بالعائد على حقوق الملكية ROE لعدم توفره في بيانات ياهو المجانية.",
    ],
  },
};
