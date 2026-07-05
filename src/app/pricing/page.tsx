import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "الخطط والأسعار",
  description:
    "خطة مجانية للفرز والفحص الشرعي وتقرير التطهير، وخطة احترافية للتنبيهات اللحظية وأوامر واتساب والاختبار التاريخي الكامل.",
};

const FREE = PLAN_LIMITS.FREE;
const PRO = PLAN_LIMITS.PRO;

interface FeatureRow {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

const FEATURES: FeatureRow[] = [
  { label: "فرز الأسهم الأمريكية والسعودية بالفحص الشرعي", free: true, pro: true },
  { label: "نسبة التطهير وتقرير تطهير المحفظة", free: true, pro: true },
  { label: "الأهداف والأوقاف الفنية (مختبرة تاريخياً)", free: true, pro: true },
  { label: "الشارت بكل الفترات الزمنية", free: true, pro: true },
  {
    label: "قائمة المتابعة",
    free: `${FREE.watchlistMax} أسهم`,
    pro: `${PRO.watchlistMax} سهماً`,
  },
  {
    label: "سجل الصفقات (المفتوحة)",
    free: `${FREE.openTradesMax} صفقات`,
    pro: `${PRO.openTradesMax} صفقة`,
  },
  {
    label: "الاختبار التاريخي",
    free: `${FREE.backtestMaxDays} جلسات`,
    pro: `${PRO.backtestMaxDays} جلسة كاملة`,
  },
  { label: "مقارنة صيغ الهدف/الوقف بالأرقام", free: false, pro: true },
  { label: "تنبيهات واتساب اللحظية (هدف/وقف/حكم شرعي/متابعة)", free: false, pro: true },
  { label: "الملخص اليومي (أمريكا + تداول) والتقرير الأسبوعي", free: false, pro: true },
  { label: "أوامر الحساب في واتساب (صفقاتي/قائمتي/تطهير)", free: false, pro: true },
];

function Mark({ v }: { v: string | boolean }) {
  if (v === true) return <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>;
  if (v === false) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  return <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{v}</span>;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          الخطط
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          الفحص الشرعي والفرز وتقرير التطهير مجانية للجميع — لأن معرفة الحلال
          لا تُباع. الاحترافية تضيف الأتمتة والعمق: تنبيهات لحظية على جوالك،
          وأوامر واتساب، والاختبار التاريخي الكامل.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/60">
              <th className="p-4 text-start font-bold text-zinc-900 dark:text-zinc-50">
                الميزة
              </th>
              <th className="p-4 text-center font-bold text-zinc-900 dark:text-zinc-50">
                المجانية
              </th>
              <th className="p-4 text-center">
                <span className="rounded-full bg-brand-600 px-3 py-1 font-bold text-white">
                  الاحترافية
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr
                key={f.label}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="p-4 text-zinc-700 dark:text-zinc-200">{f.label}</td>
                <td className="p-4 text-center">
                  <Mark v={f.free} />
                </td>
                <td className="p-4 text-center">
                  <Mark v={f.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-6 text-center">
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          كيف أشترك في الاحترافية؟
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          الاشتراك في مرحلته التجريبية — التفعيل يدوي حالياً وبوابة الدفع
          قادمة. أنشئ حسابك المجاني أولاً وستصلك تفاصيل الاشتراك عند فتح
          باب التسجيل في الاحترافية.
        </p>
        <Link href="/account" className="btn-primary mt-5 inline-block px-8 py-2.5">
          أنشئ حسابك المجاني
        </Link>
      </div>

      <p className="text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
        ⚠️ المنصة أداة فرز وتحليل آلية — ليست توصية استثمارية، والفحص الشرعي
        تقديري لا يغني عن الرجوع للهيئات الشرعية المعتمدة.
      </p>
    </div>
  );
}
