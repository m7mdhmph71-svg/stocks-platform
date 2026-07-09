// ============================================================
// فلتر Finviz المعتمد — «صيد السيولة» بدلالاته الحرفية.
// لا تغيّر finvizQuery ولا legend ولا العتبات الرقمية — إنه عقد ملزم.
// (حُذف «الزخم» و«الاستثمار» بعد أن أثبت الاختبار التاريخي ضعفهما.)
// ============================================================

import { ScreenerPreset, StrategyKey } from "@/lib/types";

/** أسماء الاستراتيجيات بالعربية — تُستخدم في الواجهة ومحرك الأهداف */
export const STRATEGY_NAMES_AR: Record<StrategyKey, string> = {
  liquidity: "صيد السيولة",
  trend: "الاتجاه الصاعد",
};

/** فلاتر بدلالات Finviz الحرفية — «الاتجاه» له ملفه المستقل في trend.ts */
export type FinvizStrategyKey = Exclude<StrategyKey, "trend">;

export const PRESETS: Record<FinvizStrategyKey, ScreenerPreset> = {
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

};
