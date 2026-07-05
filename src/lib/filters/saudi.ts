// فلتر السوق السعودي (تداول) — تبويب مستقل عن فلاتر المستخدم الثلاثة
// المحفوظة بحروفها في presets.ts، فلا يمس دلالاتها.
//
// فلسفته على نسق فلتر الزخم: سهم يرتفع اليوم بحجم أعلى من معتاده —
// مع مراعاة أن أحجام تداول أدنى بكثير من الأسواق الأمريكية،
// والأسعار بالريال السعودي.

import { FilterCondition } from "@/lib/types";

export interface SaudiPreset {
  key: "saudi";
  nameAr: string;
  taglineAr: string;
  descriptionAr: string;
  conditions: FilterCondition[];
  advancedNotesAr: string[];
}

export const SAUDI_PRESET: SaudiPreset = {
  key: "saudi",
  nameAr: "السوق السعودي",
  taglineAr: "زخم اليوم في تداول",
  descriptionAr:
    "أسهم السوق السعودي (تداول) المرتفعة اليوم بنشاط أعلى من معتادها: " +
    "تغير يومي 2% فأكثر، وحجم تداول لا يقل عن 100 ألف سهم، وبحجم نسبي " +
    "1.2 ضعف المتوسط فأكثر — مع الفحص الشرعي لكل نتيجة وأهداف وأوقاف " +
    "بمنطق السوينق. الأسعار بالريال السعودي.",
  conditions: [
    { field: "changePercent", op: "gte", value: 2 },
    { field: "volume", op: "gte", value: 100_000 },
    { field: "relativeVolume", op: "gte", value: 1.2 },
  ],
  advancedNotesAr: [
    "جلسة تداول: الأحد–الخميس 10:00–15:10 بتوقيت الرياض — خارجها تعرض الأسعار آخر إغلاق.",
    "الفحص الشرعي بنفس منهجية أيوفي 21 المطبقة على السوق الأمريكي، على قوائم Yahoo المالية.",
    "أحجام السوق السعودي أدنى من الأمريكي — عتبة الحجم هنا 100 ألف سهم لا الملايين.",
  ],
};
