import type { Metadata } from "next";
import { BacktestPanel } from "@/components/BacktestPanel";

export const metadata: Metadata = {
  title: "الاختبار التاريخي",
  description:
    "اختبر فلاتر سهم سكرينر على الجلسات الماضية: محاكاة خطة الهدف/الوقف لكل إشارة وقياس نسب الإصابة والعائد.",
};

export default function BacktestPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          الاختبار التاريخي
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          قبل أن تثق بأي فلتر، اختبره: نعيد بناء شروطه على الجلسات الماضية،
          وندخل كل إشارة بسعر إغلاقها، ونخرج عند الهدف الأول أو الوقف —
          فتعرف نسب الإصابة ومعامل الربح بأثر رجعي، لا بالانطباع.
        </p>
      </header>
      <BacktestPanel />
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        ⚠️ الأداء التاريخي لا يضمن الأداء المستقبلي — الاختبار أداة تقييم
        للفلتر وليس توصية استثمارية.
      </p>
    </div>
  );
}
