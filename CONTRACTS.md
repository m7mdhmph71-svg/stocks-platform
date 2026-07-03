# عقود البناء — sahm-screener

منصة فحص أسهم أمريكية، عربية بالكامل (RTL). Next.js 15 App Router + TypeScript strict + Tailwind 3.4.
كل الأنواع المشتركة في `src/lib/types.ts` (لا تعدّله). ملفات موجودة مسبقاً: `src/lib/cache.ts`، `src/lib/format.ts`، `src/lib/yahoo/client.ts`.

**قواعد عامة لكل الوحدات:**
- لا تلمس `package.json` ولا تضف أي تبعية npm جديدة. لا مكتبات رسم بيانية — SVG يدوي فقط.
- استيراد بالمسار `@/lib/...` و `@/components/...`.
- كل نص واجهة بالعربية الفصحى. الأرقام غربية (0-9).
- TypeScript strict: لا `any` غير مبرر، تعامل مع null دائماً.
- كل دالة جلب بيانات: أخطاء الشبكة تُرمى (لا ابتلاع صامت) — المستدعي يتعامل معها.

---

## 1) وحدة البيانات — DATA

### `src/lib/yahoo/screener.ts`
```ts
import { StockRow } from "@/lib/types";
/**
 * فرز مخصص عبر POST https://query1.finance.yahoo.com/v1/finance/screener?formatted=false
 * (استخدم yahooJson من "@/lib/yahoo/client" مع needsCrumb: true)
 * body: {size, offset:0, sortField:"dayvolume", sortType:"DESC", quoteType:"EQUITY",
 *        query:{operator:"and", operands:[...]}, userId:"", userIdType:"guid"}
 * حقول ياهو المدعومة: intradayprice, dayvolume, avgdailyvol3m, intradaymarketcap,
 *   percentchange (تغير اليوم %), region (eq "us"), exchange
 * أعد StockRow[] مُطبَّعة من quotes المعادة. من كل quote خذ:
 *   symbol, shortName/longName, fullExchangeName, regularMarketPrice,
 *   regularMarketChangePercent, regularMarketOpen (→ احسب changeFromOpenPercent =
 *   (price-open)/open*100), regularMarketVolume, averageDailyVolume3Month,
 *   marketCap, sharesOutstanding, fiftyTwoWeekHigh/Low.
 *   relativeVolume = volume/avgVolume3m. floatShares/sector/industry/weekPerf = null
 *   (تُثرى لاحقاً). shariah/targets = null.
 */
export interface CoarseQuery {
  priceMin?: number; priceMax?: number;
  volumeMin?: number;            // dayvolume
  avgVolumeMin?: number;         // avgdailyvol3m
  marketCapMin?: number;
  changePercentMin?: number; changePercentMax?: number;
  size?: number;                 // default 100, max 250
}
export async function runYahooScreener(q: CoarseQuery): Promise<StockRow[]>;
```

### `src/lib/yahoo/quote.ts`
```ts
import { Fundamentals } from "@/lib/types";
/**
 * quoteSummary عبر GET query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}
 *   ?modules=summaryProfile,defaultKeyStatistics,financialData,balanceSheetHistory,incomeStatementHistory,earningsTrend
 * (needsCrumb: true). كل القيم الرقمية تأتي بصيغة {raw, fmt} — خذ raw.
 * ملء Fundamentals:
 *  - sector/industry/longBusinessSummary من summaryProfile
 *  - floatShares, sharesOutstanding من defaultKeyStatistics
 *  - totalDebt, totalCash, currentRatio, debtToEquity (ياهو يعيدها ٪ مثل 154.2 → حوّلها لنسبة 1.542),
 *    grossMargins, returnOnEquity, targetMeanPrice, recommendationKey من financialData
 *  - shortTermInvestments, longTermInvestments من أحدث balanceSheetHistory.balanceSheetStatements
 *  - totalRevenue من financialData.totalRevenue، netIncome + interestExpense/interestIncome (إن وجدت)
 *    من أحدث incomeStatementHistory.incomeStatementHistory
 *  - revenueHistory/netIncomeHistory: من incomeStatementHistory (رتّب الأقدم أولاً)
 *  - trailingPE: من defaultKeyStatistics.trailingEps مع السعر؟ لا — خذ summaryDetail? غير مطلوب كموديول؛
 *    استخدم financialData.currentPrice / defaultKeyStatistics.trailingEps إذا trailingEps>0 وإلا null
 *  - epsGrowthNextYear: من earningsTrend.trend حيث period === "+1y" خذ growth.raw
 *  - earningsGrowthYoY: financialData.earningsGrowth
 *  - asOf: endDate لأحدث ميزانية (ISO string) وإلا null
 * كاش 6 ساعات بمفتاح `fund:{ticker}` عبر cached() من "@/lib/cache".
 * عند فشل الجلب أو غياب result: أعد null (هذه الدالة تحديداً لا ترمي — الفحص الشرعي يتحول UNKNOWN).
 */
export async function fetchFundamentals(ticker: string): Promise<Fundamentals | null>;

/** جلب متوازٍ بمحدودية concurrency=6 مع إرجاع Map — يستخدم fetchFundamentals */
export async function fetchFundamentalsBatch(tickers: string[]): Promise<Map<string, Fundamentals | null>>;
```

### `src/lib/yahoo/chart.ts`
```ts
import { Candle } from "@/lib/types";
/**
 * GET query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={range}&interval=1d
 * (بدون crumb). طبّع إلى Candle[] مرتبة تصاعدياً زمنياً، وتجاهل الشموع الناقصة (null close).
 * كاش 15 دقيقة بمفتاح `candles:{ticker}:{range}`.
 * عند الفشل أعد [] (لا ترمِ) — التحليل الفني يتخطى السهم.
 */
export type ChartRange = "1mo" | "3mo" | "6mo" | "1y" | "2y";
export async function fetchCandles(ticker: string, range?: ChartRange): Promise<Candle[]>; // default "1y"
```

### `src/lib/finviz.ts`
```ts
import { StockRow } from "@/lib/types";
/** متاح فقط إذا ضُبط env FINVIZ_AUTH_TOKEN (اشتراك Elite) */
export function finvizAvailable(): boolean;
/**
 * GET https://elite.finviz.com/export.ashx?v=152&f={finvizQuery}&auth={token}
 * CSV → StockRow[]. الأعمدة المتاحة تعتمد على v — اجعل v=152 وأعمدة c=0,1,2,3,4,6,24,25,63,64,65,66,67,68
 * إن لم تتوفر أعمدة، اترك الحقل null. عند أي فشل: أعد null (يسقط النظام إلى ياهو).
 */
export async function fetchFinvizRows(finvizQuery: string): Promise<StockRow[] | null>;
```

### `src/lib/demo/dataset.ts`
```ts
import { Candle, Fundamentals, StockRow, StrategyKey } from "@/lib/types";
/**
 * بيانات تجريبية حتمية (بدون عشوائية زمنية — seed ثابت) لنحو 36 سهماً وهمياً برموز
 * واضحة الوهمية (مثل DEMO1..). لكل استراتيجية ≥ 10 أسهم تحقق شروطها فعلاً
 * (راجع PRESETS في src/lib/filters/presets.ts).
 * غطِّ حالات شرعية متنوعة: متوافق نظيف، مختلط بنسب تطهير مختلفة، غير متوافق
 * (بنك تقليدي، خمور، قمار)، وبيانات ناقصة (UNKNOWN).
 * demoCandles: مولّد حتمي (دالة hash من الرمز) لـ 260 شمعة يومية واقعية الشكل
 * (اتجاهات صاعدة/هابطة/عرضية متنوعة حسب السهم).
 */
export function demoRows(preset: StrategyKey | "all"): StockRow[];
export function demoCandles(ticker: string): Candle[];
export function demoFundamentals(ticker: string): Fundamentals | null;
export function isDemoTicker(ticker: string): boolean;
```

---

## 2) وحدة التحليلات — ANALYTICS

### `src/lib/filters/presets.ts`
```ts
import { ScreenerPreset, StrategyKey } from "@/lib/types";
export const PRESETS: Record<StrategyKey, ScreenerPreset>;
export const STRATEGY_NAMES_AR: Record<StrategyKey, string>;
```
**الفلاتر الثلاثة حرفياً كما حدّدها المستخدم** (لا تغيّر الدلالات، وضمّن legend بكل رمز ومعناه العربي كما يلي):

1. `liquidity` — **صيد السيولة (مضاربة قصيرة)** — finvizQuery: `sh_curvol_o500,sh_float_u50,sh_price_1to10,ta_changeopen_u10,ta_perf_10to-i10`
   - sh_curvol_o500: الحجم الحالي أعلى من 500 ألف → volume gt 500000
   - sh_float_u50: الأسهم الحرة أقل من 50 مليون → floatShares lt 50000000
   - sh_price_1to10: السعر بين 1 و 10 دولار → price btwn [1,10]
   - ta_changeopen_u10: التغير من الافتتاح أعلى من 10% → changeFromOpenPercent gt 10
   - ta_perf_10to-i10: أداء اليوم بين -10% و +10% → changePercent btwn [-10,10]

2. `momentum` — **الزخم / السوينق** — finvizQuery: `sh_curvol_o500,sh_float_o20,sh_price_1to10,sh_relvol_o1,ta_changeopen_u5,ta_perf_1w10o`
   - sh_curvol_o500: الحجم الحالي أعلى من 500 ألف → volume gt 500000
   - sh_float_o20: الأسهم الحرة أعلى من 20 مليون → floatShares gt 20000000
   - sh_price_1to10: السعر بين 1 و 10 دولار → price btwn [1,10]
   - sh_relvol_o1: الحجم النسبي أعلى من 1 → relativeVolume gt 1
   - ta_changeopen_u5: التغير من الافتتاح أعلى من 5% → changeFromOpenPercent gt 5
   - ta_perf_1w10o: أداء الأسبوع أعلى من 10% → weekPerfPercent gt 10

3. `longterm` — **الاستثمار طويل المدى** — finvizQuery: `cap_smallover,fa_curratio_o1,fa_debteq_u1,fa_eps5years_pos,fa_epsyoy_o5,fa_epsyoy1_pos,fa_grossmargin_pos,fa_pe_u25,fa_roi_o10,fa_sales5years_pos,geo_usa,sh_avgvol_o500,sh_float_o50,sh_price_o5,ta_highlow50d_a10h,ta_rsi_nob60,ta_sma200_pa`
   - conditions العادية: marketCap gte 300000000 (Small+)، avgVolume3m gt 500000، floatShares gt 50000000، price gt 5
   - legend الكامل (17 رمزاً بمعانيها العربية كما وردت من المستخدم)
   - الشروط الأساسية/الفنية (تُقيَّم في الـ API بعد الإثراء وليست ضمن conditions):
     currentRatio > 1، debtToEquity < 1، نمو ربحية 5 سنوات موجب (تقريب: اتجاه netIncomeHistory موجب)،
     earningsGrowthYoY > 5%، epsGrowthNextYear > 0، grossMargins > 0، trailingPE < 25 وموجب،
     returnOnEquity > 10% (أقرب متاح لـ ROI)، اتجاه revenueHistory موجب، ضمن 10% من قمة 50 يوم،
     RSI14 ≤ 60، السعر فوق SMA200.
     ضع دالة مساعدة مصدَّرة: `passesLongtermFundamentals(f: Fundamentals): {pass: boolean; failsAr: string[]}`
     و `passesLongtermTechnicals(price: number, t: TechnicalSnapshot): {pass: boolean; failsAr: string[]}`
     في ملف `src/lib/filters/longterm.ts`.
   - advancedNotesAr: اشرح أن نمو 5 سنوات مُقرَّب من 4 سنوات متاحة، وROI مُقرَّب بـ ROE (حدود بيانات ياهو المجانية).

### `src/lib/filters/engine.ts`
```ts
import { FilterCondition, StockRow } from "@/lib/types";
/** null في الحقل = لا يجتاز. btwn شاملة الطرفين. */
export function evalCondition(row: StockRow, cond: FilterCondition): boolean;
export function applyConditions(rows: StockRow[], conds: FilterCondition[]): StockRow[];
/** تحقّق من JSON قادم من العميل وأعد شروطاً سليمة فقط (تجاهل غير الصالح بهدوء) */
export function parseConditions(raw: unknown): FilterCondition[];
```

### `src/lib/shariah/rules.ts` + `src/lib/shariah/screen.ts`
```ts
import { Fundamentals, ShariahResult } from "@/lib/types";
export function screenShariah(f: Fundamentals | null): ShariahResult;
```
**المنهجية (وثّقها في الكود وفي methodologyAr):** معيار هيئة المحاسبة والمراجعة AAOIFI (المعيار 21):
- **فحص النشاط**: قائمة سوداء لقطاعات/صناعات ياهو المحرّمة أساساً:
  البنوك التقليدية وخدمات الائتمان والتأمين التقليدي وإدارة الأصول الربوية (Banks—*, Credit Services, Insurance—*, Asset Management, Financial Conglomerates, Mortgage Finance)،
  الخمور (Beverages—Wineries & Distilleries, Beverages—Brewers)، التبغ (Tobacco)، القمار والكازينوهات (Gambling, Casinos & Gaming, Resorts & Casinos)، الترفيه للبالغين، لحم الخنزير (فحص نصي في الملخص)، القنّب (Cannabis / Drug Manufacturers—Specialty… فحص نصي "cannabis")، الدفاع/الأسلحة تُعد مختلطة لا محرمة (لا تُدرج).
  ملاحظة: REIT التقليدية (مثل Mortgage REITs) غير متوافقة لاعتمادها على الفوائد.
  البنوك/التأمين: businessCompliant=false → NON_COMPLIANT مباشرة.
- **النسب المالية** (كلها ÷ القيمة السوقية، والحد 30%):
  1. `debt`: إجمالي الدين الربوي (totalDebt) ÷ marketCap ≤ 30%
  2. `interestSecurities`: (totalCash + shortTermInvestments + longTermInvestments) ÷ marketCap ≤ 30%
  3. `impureIncome`: الدخل غير المباح ÷ إجمالي الإيراد ≤ 5% — قدّره بـ interestIncome إن وُجد،
     وإلا قدّره تحفظياً بـ (totalCash + shortTermInvestments) × 4.5% (عائد فائدة افتراضي) ÷ totalRevenue،
     ووضّح في detailAr أنه تقدير.
- **الحكم**: نشاط محرم → NON_COMPLIANT. كل النسب ناجحة والدخل غير المباح ≈ 0 → COMPLIANT.
  النسب ناجحة مع دخل غير مباح ≤ 5% → MIXED (يجوز مع التطهير عند من يعتمد المعيار) — verdictAr: "متوافق مع وجوب التطهير".
  أي نسبة راسبة → NON_COMPLIANT. بيانات مفقودة (marketCap أو totalDebt غائبة كلياً) → UNKNOWN.
- **نسبة التطهير** purificationRatio = الدخل غير المباح ÷ totalRevenue × 100.
  purificationPerShare = الدخل غير المباح ÷ sharesOutstanding.
- لا تنس: النتيجة **تقديرية اجتهادية** وليست فتوى — ضَع ذلك في methodologyAr.

### `src/lib/targets/technicals.ts`
```ts
import { Candle, TechnicalSnapshot } from "@/lib/types";
/** يتطلب ≥ 20 شمعة وإلا يعيد قيماً null حيث يستحيل الحساب.
 * RSI14 و ATR14 بطريقة Wilder smoothing. pivot كلاسيكي من آخر شمعة مكتملة:
 * P=(H+L+C)/3, R1=2P-L, S1=2P-H, R2=P+(H-L), S2=P-(H-L), R3=H+2(P-L), S3=L-2(H-P)
 * weekPerf: آخر إغلاق ÷ إغلاق قبل 5 جلسات، monthPerf: قبل 21 جلسة.
 * high50d/low50d من آخر 50 جلسة، high52w/low52w من آخر 252 جلسة.
 */
export function computeTechnicals(candles: Candle[]): TechnicalSnapshot;
```

### `src/lib/targets/engine.ts`
```ts
import { StrategyKey, TargetsResult, TechnicalSnapshot } from "@/lib/types";
/**
 * أهداف لكل استراتيجية (entry = السعر الحالي):
 * - liquidity (مضاربة يومية): T1 = entry + 1×ATR، T2 = entry + 2×ATR، T3 = min(R2, high50d) الأعلى منطقياً؛
 *   وقف = entry − 1.5×ATR (أو تحت S1 أيهما أقرب حماية). أساس كل هدف بالعربية (مثال: "مدى الحركة اليومي ATR").
 * - momentum (سوينق): T1 = R1، T2 = R2، T3 = high52w إن كان أعلى وإلا R3؛
 *   وقف = أسفل SMA20 أو entry − 2×ATR أيهما أعلى (أقرب للسعر).
 * - longterm: T1 = هدف المحللين analystTarget إن توفر وإلا entry × 1.15،
 *   T2 = entry × (1 + توقع نمو معقول: استخدم 25%)، T3 = high52w × 1.10؛
 *   وقف = SMA200 (كسر الاتجاه الطويل).
 * تأكد أن الأهداف مرتّبة تصاعدياً وفوق entry (استبعد/عدّل أي مستوى دون entry بأقل تعديل منطقي).
 * riskReward = (T1 − entry) ÷ (entry − stop) إذا كان الوقف تحت السعر.
 * trend: UP إذا السعر فوق SMA50 و SMA50 فوق SMA200 (أو فوق SMA20>SMA50 عند غياب 200)؛
 *   DOWN عكسها؛ وإلا SIDEWAYS. trendAr بالعربية.
 * score 0-100: ركّب من (اتجاه، RSI في نطاق صحي 40-65، قرب من قمة 50 يوم، حجم نسبي إن مرّر) — وثّق الوزن.
 * expectationAr: جملة عربية تلخص التوقع الآلي، مثال:
 *   "اتجاه صاعد فوق المتوسطات، الزخم صحي (RSI 54). السيناريو الإيجابي يستهدف $12.40 ثم $13.80،
 *    ويُلغى بالإغلاق دون $9.20." — ولا تنسَ أنها ليست توصية (الواجهة تعرض إخلاء المسؤولية).
 * analystTarget يُمرَّر اختيارياً.
 */
export function computeTargets(
  strategy: StrategyKey,
  entry: number,
  tech: TechnicalSnapshot,
  analystTarget?: number | null
): TargetsResult;
```

---

## 3) واجهة المستخدم — UI

تملك: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/screener/page.tsx`, `src/app/stock/[ticker]/page.tsx`, وكل `src/components/*`. **لا تنشئ مسارات API** — ستكون جاهزة.

### واجهات الـ API التي تستهلكها (الأشكال في types.ts):
- `GET /api/screener?preset=liquidity|momentum|longterm` → `ScreenerResponse`
- `GET /api/screener?preset=custom&conditions=<encodeURIComponent(JSON.stringify(FilterCondition[]))>` → `ScreenerResponse`
- `GET /api/stock/{ticker}` → `StockDetailResponse`
- كل استجابة قد تكون `{ error: string }` مع status ≠ 200 — اعرض رسالة خطأ عربية أنيقة مع زر إعادة محاولة.
- `source === "demo"` → اعرض شريطاً كهرمانياً ثابتاً: "بيانات تجريبية للعرض — تعذّر الوصول لمصدر البيانات الحي".

### الصفحات
1. **`/` الرئيسية**: ترويسة المنصة (اسم: **سهم سكرينر** — منصة الفرز الشرعي والفني)، ثم ثلاث بطاقات استراتيجيات
   (من PRESETS: الاسم، الوصف، الشروط المفتاحية كشارات، زر "افتح الفلتر") تقود لـ `/screener?preset=...`،
   وقسم "كيف نفحص الشرعية؟" يشرح منهجية AAOIFI الثلاثية ونسبة التطهير باختصار بصري (ثلاث عدّادات 30/30/5)،
   وقسم إخلاء مسؤولية واضح.
2. **`/screener`**: تبويبات الاستراتيجيات الثلاث + تبويب "فلتر مخصص".
   - لوحة legend قابلة للطي تعرض رموز Finviz الأصلية ومعانيها (من preset.legend) — للمصداقية مع فلاتر المستخدم.
   - الفلتر المخصص: منشئ شروط (حقل من FilterField بأسماء عربية، معامل، قيمة/نطاق) يبني conditions JSON.
   - جدول النتائج (مكوّن `StockTable`): الرمز (رابط للتفاصيل)، الاسم، السعر، تغير اليوم%، التغير من الافتتاح%،
     الحجم، الحجم النسبي، الأسهم الحرة (fmtCompact)، شارة الشرعية (`ShariahBadge`: أخضر متوافق/كهرماني مختلط
     مع نسبة التطهير/أحمر غير متوافق/رمادي غير معروف)، الهدف الأول وscore مصغّر.
   - فرز بالنقر على رؤوس الأعمدة، وحالة تحميل هيكلية (skeleton) وحالة "لا نتائج تطابق الشروط الآن".
   - ملاحظة أعلى الجدول: عدد النتائج + وقت البيانات (asOf) + notesAr إن وجدت.
   - استخدم `useSearchParams` مع `<Suspense>` (إلزامي في Next 15).
3. **`/stock/[ticker]`**: 
   - رأس: الرمز/الاسم/البورصة/القطاع + السعر الكبير مع التغير.
   - **بطاقة الفحص الشرعي** (`ShariahCard`): الحكم بشارة كبيرة، فحص النشاط، ثلاث أشرطة تقدم للنسب
     (القيمة مقابل الحد 30/30/5 مع تلوين نجاح/فشل)، نسبة التطهير بارزة، وmethodologyAr في تلميح/تفصيل.
   - **حاسبة التطهير** (`PurificationCalc` — client): إدخال عدد الأسهم + أيام الاحتفاظ (افتراضي 365) +
     الأرباح الموزعة المستلمة (اختياري). تعرض: مبلغ التطهير بطريقة عدد الأسهم
     (أسهم × purificationPerShare × أيام/365) وطريقة الأرباح الموزعة (توزيعات × purificationRatio).
   - **بطاقة الأهداف والتوقعات** (`TargetsCard`): تبويب بين الاستراتيجيات الثلاث من targetsByStrategy،
     يعرض: entry، الأهداف الثلاثة بأساسها، الوقف، R/R، الاتجاه، score كمقياس قوسي/شريطي، expectationAr،
     وهدف المحللين إن وجد.
   - **الرسم البياني** (`PriceChart` — SVG نقي): خط إغلاق مع تظليل تدرجي + خطوط أفقية متقطعة للأهداف
     (أخضر) والوقف (أحمر) وSMA50/200 إن توفرت، محاور مبسطة، تفاعل hover اختياري بسيط.
   - جدول مؤشرات فنية مختصر (RSI، ATR، المتوسطات، قمة/قاع 50ي و52أ).
4. **`layout.tsx`**: `<html lang="ar" dir="rtl">`، خط عربي عبر `next/font/google` (Tajawal أوزان 400/500/700،
   variable: "--font-arabic"، مع `display: "swap"`) — إن فشل البناء لأي سبب شبكي استخدم Tahoma فقط.
   شريط تنقّل علوي ثابت (الرئيسية/الفرز) + بحث سريع عن رمز (input ينقل لـ `/stock/{ticker}`)
   + تذييل بإخلاء المسؤولية الكامل:
   "المنصة أداة فرز آلية للأغراض التعليمية؛ ليست توصية استثمارية، والفحص الشرعي تقديري اجتهادي
    مبني على القوائم المالية المتاحة ولا يغني عن الرجوع للهيئات الشرعية المعتمدة."

### الهوية البصرية
- داكن/فاتح تلقائي (darkMode: "media"). الأساس زنكي (zinc)، البراند أخضر `brand` (معرف في tailwind.config).
- دلالات ثابتة: أخضر emerald = متوافق/صعود، أحمر red = غير متوافق/هبوط، كهرماني amber = مختلط/تنبيه، رمادي = مجهول.
- بطاقات بحواف `rounded-2xl` وظلال خفيفة وحدود `border-zinc-200 dark:border-zinc-800`، كثافة معلومات محترمة بلا زحام.
- الجداول: أرقام tabular-nums بمحاذاة نهاية (end)، صفوف تحوم بخلفية خفيفة.
- استجابة كاملة للجوال (الجدول داخل حاوية `overflow-x-auto`).

---

## 4) مسارات الـ API (تُكتب في مرحلة التكامل — للاطلاع)
- `/api/screener`: يحاول finviz (إن توفر التوكن) ثم Yahoo (فرز خشن → إثراء float عبر fetchFundamentalsBatch
  → إثراء weekPerf/التقنية عبر fetchCandles حسب الحاجة → applyConditions الدقيقة → إثراء شرعي)
  وعند فشل الشبكة كلياً → demo. يعيد ScreenerResponse.
- `/api/stock/[ticker]`: قندلات 1y + fundamentals + screenShariah + computeTargets للاستراتيجيات الثلاث.
