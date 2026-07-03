import Link from "next/link";
import { PRESETS } from "@/lib/filters/presets";
import { StrategyCard } from "@/components/StrategyCard";
import { LimitDonut } from "@/components/LimitDonut";
import { SectionTitle } from "@/components/ui";

export default function HomePage() {
  return (
    <div>
      {/* الترويسة */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-brand-50 via-white to-white dark:border-zinc-800 dark:from-brand-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 start-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="chip mb-5 border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
            فحص شرعي · فرز فني · أهداف وتوقعات
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            سهم سكرينر
            <span className="mt-3 block bg-gradient-to-l from-brand-600 to-emerald-500 bg-clip-text text-2xl text-transparent sm:text-3xl">
              منصة الفرز الشرعي والفني للأسهم الأمريكية
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            افرز السوق بثلاث استراتيجيات جاهزة أو بفلترك الخاص، وافحص توافق كل
            سهم مع المعايير الشرعية واحسب نسبة التطهير، مع أهداف سعرية وتوقعات
            آلية لكل استراتيجية.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/screener" className="btn-primary px-6 py-2.5 text-base">
              ابدأ الفرز الآن
            </Link>
            <a href="#shariah" className="btn-ghost px-6 py-2.5 text-base">
              كيف نفحص الشرعية؟
            </a>
          </div>
        </div>
      </section>

      {/* الاستراتيجيات */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle sub="ثلاث استراتيجيات جاهزة بمعايير محددة وشفافة — افتح أياً منها وعدّل ما تشاء.">
          استراتيجيات الفرز
        </SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          <StrategyCard preset={PRESETS.liquidity} />
          <StrategyCard preset={PRESETS.momentum} />
          <StrategyCard preset={PRESETS.longterm} />
        </div>
      </section>

      {/* المنهجية الشرعية */}
      <section
        id="shariah"
        className="border-y border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle sub="منهجية مستندة إلى معيار هيئة المحاسبة والمراجعة للمؤسسات المالية الإسلامية (AAOIFI — المعيار 21): فحص النشاط ثم ثلاث نسب مالية.">
            كيف نفحص الشرعية؟
          </SectionTitle>

          <div className="grid gap-6 sm:grid-cols-3">
            <LimitDonut
              percent={30}
              label="الدين الربوي"
              sublabel="إجمالي الدين بفائدة ÷ القيمة السوقية — يجب ألا يتجاوز 30%"
            />
            <LimitDonut
              percent={30}
              label="الأوراق المالية الربوية"
              sublabel="النقد والاستثمارات بفائدة ÷ القيمة السوقية — يجب ألا تتجاوز 30%"
            />
            <LimitDonut
              percent={5}
              label="الدخل غير المباح"
              sublabel="الدخل من مصادر غير مباحة ÷ إجمالي الإيراد — يجب ألا يتجاوز 5%"
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-2 font-bold text-zinc-900 dark:text-zinc-50">
                فحص النشاط أولاً
              </h3>
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                قبل النسب المالية نفحص النشاط الأساسي للشركة: فالبنوك التقليدية
                وشركات التأمين التقليدي والخمور والتبغ والقمار ونحوها غير
                متوافقة مباشرة مهما كانت نسبها المالية. أما الشركات ذات النشاط
                المباح فتنتقل إلى فحص النسب الثلاث.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="mb-2 font-bold text-zinc-900 dark:text-zinc-50">
                ما نسبة التطهير؟
              </h3>
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                إذا اجتازت الشركة الفحص لكن لديها دخل غير مباح لا يتجاوز 5% من
                إيرادها، فالسهم «مختلط»: يجوز تملّكه عند من يعتمد هذا المعيار
                بشرط التخلّص من نسبة الدخل غير المباح — وهي «نسبة التطهير» —
                بالتصدّق بها من الأرباح. توفر المنصة حاسبة تطهير لكل سهم بطريقتي
                عدد الأسهم والأرباح الموزعة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* إخلاء المسؤولية */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="card border-amber-200 bg-amber-50/60 p-6 dark:border-amber-800/50 dark:bg-amber-950/30">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-sm text-white">
              !
            </span>
            إخلاء مسؤولية
          </h2>
          <p className="text-sm leading-7 text-amber-800/90 dark:text-amber-100/90">
            المنصة أداة فرز آلية للأغراض التعليمية؛ ليست توصية استثمارية، والفحص
            الشرعي تقديري اجتهادي مبني على القوائم المالية المتاحة ولا يغني عن
            الرجوع للهيئات الشرعية المعتمدة. الأهداف والتوقعات المعروضة حسابات
            فنية آلية قد تخطئ، وقد تتأخر البيانات عن السوق المباشر — تحقّق دائماً
            قبل اتخاذ أي قرار مالي.
          </p>
        </div>
      </section>
    </div>
  );
}
