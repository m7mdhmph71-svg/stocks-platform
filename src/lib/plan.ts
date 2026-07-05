// حدود الخطط FREE/PRO — المصدر الوحيد للحقيقة. كل مسار يحتكم إلى
// limitsFor() ولا يضمّن أرقاماً خاصة به.
//
// فلسفة التقسيم: الفرز والفحص الشرعي وتقرير التطهير مجانية (التطهير
// عبادة لا تُباع — وهي أيضاً أقوى دعاية للمنصة)؛ المدفوع هو الأتمتة
// والعمق: التنبيهات اللحظية، أوامر الحساب في واتساب، سعة القوائم،
// ونافذة الاختبار التاريخي الكاملة مع مقارنة الصيغ.

import { db, dbEnabled } from "@/lib/db";

export type PlanKey = "FREE" | "PRO";

export interface PlanLimits {
  /** أقصى أسهم في قائمة المتابعة */
  watchlistMax: number;
  /** أقصى صفقات مفتوحة في السجل */
  openTradesMax: number;
  /** أقصى نافذة للاختبار التاريخي بالجلسات */
  backtestMaxDays: number;
  /** مقارنة صيغ الهدف/الوقف في الاختبار */
  backtestCompare: boolean;
  /** التنبيهات اللحظية والتقرير الأسبوعي عبر واتساب */
  alerts: boolean;
  /** أوامر الحساب في واتساب (صفقاتي/قائمتي/تطهير) */
  whatsappAccountCommands: boolean;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: {
    watchlistMax: 10,
    openTradesMax: 10,
    backtestMaxDays: 10,
    backtestCompare: false,
    alerts: false,
    whatsappAccountCommands: false,
  },
  PRO: {
    watchlistMax: 50,
    openTradesMax: 30,
    backtestMaxDays: 40,
    backtestCompare: true,
    alerts: true,
    whatsappAccountCommands: true,
  },
};

export const PLAN_NAMES_AR: Record<PlanKey, string> = {
  FREE: "المجانية",
  PRO: "الاحترافية",
};

/** رسالة ترقية موحدة تُلحق برسائل بلوغ الحدود */
export const UPGRADE_HINT_AR = "الترقية إلى الاحترافية من صفحة «الخطط».";

/**
 * الخطة الفعلية للمستخدم — PRO منتهية الصلاحية تُحتسب FREE.
 * userId = null (زائر غير مسجل) → FREE.
 */
export async function effectivePlan(userId: string | null): Promise<PlanKey> {
  if (!userId || !dbEnabled()) return "FREE";
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpires: true },
  });
  if (!user) return "FREE";
  if (user.plan !== "PRO") return "FREE";
  if (user.planExpires !== null && user.planExpires < new Date()) return "FREE";
  return "PRO";
}

export async function limitsFor(userId: string | null): Promise<PlanLimits> {
  return PLAN_LIMITS[await effectivePlan(userId)];
}
