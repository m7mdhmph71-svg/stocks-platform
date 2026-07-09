import Link from "next/link";
import { PRESETS } from "@/lib/filters/presets";
import { TREND_PRESET } from "@/lib/filters/trend";
import { SearchBox } from "@/components/SearchBox";
import { MarketOverview } from "@/components/MarketOverview";
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
              منصة الفرز الشرعي والفني للأسهم الأمريكية والسعودية
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            افرز السوقين الأمريكي والسعودي بأربع استراتيجيات جاهزة أو بفلترك
            الخاص، وافحص توافق كل سهم مع المعايير الشرعية واحسب نسبة التطهير،
            مع خطة أهداف ووقف ملائمة لكل سهم — مختبرة على التاريخ بالأرقام.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/screener" className="btn-primary px-6 py-2.5 text-base">
              🇺🇸 افرز السوق الأمريكي
            </Link>
            <Link
              href="/screener?preset=saudi"
              className="btn-primary bg-emerald-700 px-6 py-2.5 text-base hover:bg-emerald-800"
            >
              🇸🇦 افرز السوق السعودي
            </Link>
            <a href="#shariah" className="btn-ghost px-6 py-2.5 text-base">
              كيف نفحص الشرعية؟
            </a>
          </div>

          {/* فحص سهم بعينه مباشرة */}
          <div className="mx-auto mt-10 max-w-xl text-start">
            <p className="mb-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-200">
              أو افحص سهماً بعينه الآن — الحكم الشرعي ونسبة التطهير والأهداف:
            </p>
            <SearchBox variant="hero" />
          </div>
        </div>
      </section>

      {/* نبض السوق الآن */}
      <MarketOverview />

      {/* ابدأ هنا — الرحلة في ثلاث خطوات */}
      <section className="border-b border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle sub="ثلاث خطوات من الفرز إلى التنبيه على جوالك.">
            كيف تستخدم المنصة؟
          </SectionTitle>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              {
                n: "١",
                t: "افرز",
                d: "اختر السوق والاستراتيجية فتظهر الأسهم المطابقة اليوم مع الحكم الشرعي لكل سهم.",
              },
              {
                n: "٢",
                t: "افحص",
                d: "افتح السهم: حكمه الشرعي ونسبة تطهيره، والخطة الملائمة له بهدف ووقف مبنيين على بنية الشارت.",
              },
              {
                n: "٣",
                t: "تابع وتنبّه",
                d: "أضفه لقائمتك أو وثّق صفقتك، واربط واتسابك فتصلك التنبيهات لحظة لمس الهدف أو الوقف.",
              },
            ].map((step) => (
              <li key={step.n} className="card flex gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                    {step.t}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {step.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* الاستراتيجيات الأربع */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle sub="استراتيجيتان مُثبَتتان بمعايير شفافة ومختبرة تاريخياً — ولكل سهم تُرشَّح الخطة الملائمة له تلقائياً.">
          استراتيجيات الفرز
        </SectionTitle>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <StrategyCard
            href="/screener?preset=trend"
            nameAr={TREND_PRESET.nameAr}
            taglineAr={TREND_PRESET.taglineAr}
            descriptionAr="أسهم جودة سائلة في اتجاه صاعد مؤكد قرب قممها السنوية — المنهج الأكثر توثيقاً واستقراراً، وأمتن الاثنتين في اختبارنا التاريخي. للسوقين الأمريكي والسعودي."
            chips={["فوق متوسط 200 يوم", "قرب قمة 52 أسبوعاً", "زخم شهري موجب", "أفق أسابيع"]}
            highlight
          />
          <StrategyCard
            href="/screener?preset=liquidity"
            nameAr={PRESETS.liquidity.nameAr}
            taglineAr={PRESETS.liquidity.taglineAr}
            descriptionAr={PRESETS.liquidity.descriptionAr}
            chips={PRESETS.liquidity.legend.map((l) => l.meaningAr)}
          />
        </div>
        <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
          استراتيجيتان فقط — كل واحدة مُثبَتة بالاختبار التاريخي بعائد/مخاطرة
          سليم وهامش أمان موجب. السوق السعودي متاح بالاثنتين.
        </p>
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
