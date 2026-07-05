import { NextRequest, NextResponse } from "next/server";
import { runYahooScreener } from "@/lib/yahoo/screener";
import { fetchCandles } from "@/lib/yahoo/chart";
import { fetchFundamentalsBatch } from "@/lib/yahoo/quote";
import { cached } from "@/lib/cache";
import { sessionUserId } from "@/lib/auth/session";
import { limitsFor, UPGRADE_HINT_AR } from "@/lib/plan";
import {
  BacktestResult,
  BacktestStrategy,
  FormulaComparison,
  horizonFor,
  runBacktest,
  runFormulaComparison,
  summarizeBacktest,
} from "@/lib/backtest/engine";

export const dynamic = "force-dynamic";
/** الاختبار يجلب شموع مئات الأسهم أول مرة — نسمح بمهلة أطول */
export const maxDuration = 120;

/** حجم كون الاختبار (أعلى الأسهم سيولة ضمن نطاق سعري موسع) */
const UNIVERSE_CAP = 300;
/** أقصى نافذة اختبار بالجلسات لكل استراتيجية: المضاربة قصيرة النفس،
 * والاتجاه يحتاج مدى أطول ليكتمل أفق صفقاته (شموع سنتين تسمح بـ150) */
function maxDaysFor(strategy: BacktestStrategy): number {
  return strategy === "trend" ? 150 : 40;
}
const DEFAULT_DAYS = 30;

const FLOAT_LIMITS: Record<
  BacktestStrategy,
  { min: number | null; max: number | null }
> = {
  liquidity: { min: null, max: 50_000_000 },
  momentum: { min: 20_000_000, max: null },
  trend: { min: null, max: null }, // كون الجودة لا يقيده شرط أسهم حرة
};

export interface BacktestResponse extends BacktestResult {
  asOf: string;
  universeSize: number;
  notesAr: string[];
}

export interface BacktestCompareResponse extends FormulaComparison {
  asOf: string;
  universeSize: number;
  notesAr: string[];
}

type Series = { ticker: string; name: string; candles: Awaited<ReturnType<typeof fetchCandles>> }[];

/** الكون + الشموع بحسب الاستراتيجية — مشترك بين الاختبار ومقارنة الصيغ */
async function loadSeries(strategy: BacktestStrategy): Promise<Series> {
  // المضاربة: أعلى الأسهم سيولة بنطاق سعري موسع (0.5-15) ليشمل أسهماً
  // كانت داخل نطاق 1-10 في الجلسات الماضية وانزاحت قليلاً منذ ذلك الحين.
  // الاتجاه: كون جودة وسيولة (سعر ≥ 5، قيمة ≥ 300م) وشموع سنتين
  // (بوابة SMA200 تحتاج 210 جلسات تاريخ قبل أول إشارة).
  const universe = await runYahooScreener(
    strategy === "trend"
      ? {
          priceMin: 5,
          avgVolumeMin: 500_000,
          marketCapMin: 300_000_000,
          size: 250,
          cap: UNIVERSE_CAP,
        }
      : {
          priceMin: 0.5,
          priceMax: 15,
          volumeMin: 300_000,
          size: 250,
          cap: UNIVERSE_CAP,
        }
  );

  const range = strategy === "trend" ? "2y" : "6mo";
  const minLen = strategy === "trend" ? 250 : 30;
  const series: Series = [];
  const CONC = 8;
  for (let i = 0; i < universe.length; i += CONC) {
    const batch = universe.slice(i, i + CONC);
    const fetched = await Promise.all(
      batch.map(async (r) => ({
        ticker: r.ticker,
        name: r.name,
        candles: await fetchCandles(r.ticker, range),
      }))
    );
    for (const f of fetched) {
      if (f.candles.length >= minLen) series.push(f);
    }
  }
  return series;
}

/** مقارنة صيغ الهدف/الوقف الأربع على نفس إشارات الفترة */
async function buildComparison(
  strategy: BacktestStrategy,
  daysBack: number
): Promise<BacktestCompareResponse> {
  const series = await loadSeries(strategy);
  const cmp = runFormulaComparison(strategy, series, daysBack);
  return {
    ...cmp,
    asOf: new Date().toISOString(),
    universeSize: series.length,
    notesAr: [
      "كل الصيغ تُحاكى على الإشارات نفسها: دخول بإغلاق جلسة الإشارة، الوقف يُغلَّب تحفظاً عند التلامس المزدوج، وفجوات الافتتاح تُحتسب بسعر الافتتاح.",
      `الخروج الزمني بعد ${horizonFor(strategy)} جلسة لكل الصيغ، والإشارات غير المحسومة بعدُ مستثناة.`,
      "المقارنة قبل شرط الأسهم الحرة (يستوي أثره على كل الصيغ فلا يغيّر الترتيب).",
      "المنصة تعتمد لكل استراتيجية صيغتها الرابحة تجريبياً: الكلاسيكية للزخم، والهيكلية لصيد السيولة والاتجاه الصاعد — وللاتجاه الوقفُ المتحرك أفضل خطة خروج عملية.",
      "صيغتا «ليلة واحدة» و«جلسة واحدة» اختبارا توقيت خالصان (بلا هدف ولا وقف) — تكشفان أين نافذة الربح حول الإشارة.",
    ],
  };
}

async function buildBacktest(
  strategy: BacktestStrategy,
  daysBack: number
): Promise<BacktestResponse> {
  const notesAr: string[] = [];
  const series = await loadSeries(strategy);

  // الاختبار الأولي (بلا شرط الأسهم الحرة)
  const prelim = runBacktest(strategy, series, daysBack);

  // 4) شرط الأسهم الحرة: يُطبَّق بالقيمة الحالية على رموز الإشارات فقط
  const limits = FLOAT_LIMITS[strategy];
  const matchTickers = Array.from(
    new Set(prelim.days.flatMap((d) => d.signals.map((s) => s.ticker)))
  );
  let dropped = 0;
  let unknownFloat = 0;
  if (matchTickers.length > 0) {
    const funds = await fetchFundamentalsBatch(matchTickers);
    const allowed = new Set<string>();
    for (const t of matchTickers) {
      const f = funds.get(t);
      const float = f?.floatShares ?? null;
      if (float === null) {
        unknownFloat++;
        continue; // مجهول الأسهم الحرة — يُستبعد حفاظاً على دقة الشرط
      }
      if (limits.max !== null && float >= limits.max) {
        dropped++;
        continue;
      }
      if (limits.min !== null && float <= limits.min) {
        dropped++;
        continue;
      }
      allowed.add(t);
    }
    prelim.days = prelim.days
      .map((d) => ({
        ...d,
        signals: d.signals.filter((s) => allowed.has(s.ticker)),
      }))
      .filter((d) => d.signals.length > 0);

    // أعِد حساب الملخص بعد الفلترة
    prelim.summary = summarizeBacktest(prelim.days, prelim.summary.daysTested);
  }

  if (dropped > 0) {
    notesAr.push(
      `استُبعد ${dropped} رمزاً لعدم استيفاء شرط الأسهم الحرة (بقيمتها الحالية — تقريب مقبول لأنها تتغير ببطء).`
    );
  }
  if (unknownFloat > 0) {
    notesAr.push(`استُبعد ${unknownFloat} رمزاً مجهول الأسهم الحرة.`);
  }
  notesAr.push(
    `خطة الصفقة المحاكاة: دخول عند إغلاق جلسة الإشارة، خروج عند الهدف الأول أو الوقف (المحسوبين بمحرك أهداف المنصة من بيانات ما قبل الإشارة فقط) — الوقف يُغلَّب تحفظاً إن لامسا معاً في جلسة واحدة، وخروج زمني بعد ${horizonFor(strategy)} جلسة.`,
    strategy === "trend"
      ? `الكون: ${series.length} سهم جودة (سعر ≥ 5$، قيمة ≥ 300م، متوسط حجم ≥ 500 ألف) — إشارة الدخول: قمة إغلاق جديدة لخمسين جلسة داخل هيكل صاعد قائم.`
      : `الكون: أعلى ${series.length} سهماً سيولة حالياً بنطاق سعري 0.5-15$ — أسهم شُطبت أو تغيرت جذرياً لا يشملها الاختبار (انحياز البقاء).`,
    "الشروط مقيسة على أسعار إغلاق الجلسات (الفرز الحي يقيسها لحظياً أثناء التداول)، والحجم النسبي مُقرَّب بمتوسط 20 جلسة."
  );

  return {
    ...prelim,
    asOf: new Date().toISOString(),
    universeSize: series.length,
    notesAr,
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preset = sp.get("preset") ?? "";

  if (preset === "longterm") {
    return NextResponse.json(
      {
        error:
          "فلتر الاستثمار طويل المدى لا يمكن اختباره تاريخياً بدقة: شروطه الأساسية (مكرر الربحية، النمو، العائد على الملكية…) تتطلب قوائم مالية «كما كانت» في كل تاريخ ماضٍ، وهي غير متاحة في المصادر المجانية. فلترا السيولة والزخم قابلان للاختبار لأن شروطهما سعرية بالكامل.",
      },
      { status: 400 }
    );
  }
  if (preset !== "liquidity" && preset !== "momentum" && preset !== "trend") {
    return NextResponse.json(
      { error: "حدّد فلتراً قابلاً للاختبار: liquidity أو momentum أو trend." },
      { status: 400 }
    );
  }

  // حدود الخطة: الزائر وغير المشترك على حدود المجانية
  const limits = await limitsFor(await sessionUserId());

  const strategyMax = maxDaysFor(preset);
  const daysRaw = Number(sp.get("days") ?? DEFAULT_DAYS);
  const requested = Number.isFinite(daysRaw) ? Math.floor(daysRaw) : DEFAULT_DAYS;
  const days = Math.max(
    5,
    Math.min(strategyMax, Math.min(limits.backtestMaxDays, requested))
  );
  const clamped = requested > days;

  try {
    if (sp.get("compare") === "1") {
      if (!limits.backtestCompare) {
        return NextResponse.json(
          {
            error: `مقارنة صيغ الهدف/الوقف من مزايا الخطة الاحترافية — ${UPGRADE_HINT_AR}`,
          },
          { status: 403 }
        );
      }
      const res = await cached<BacktestCompareResponse>(
        `backtest:compare:${preset}:${days}`,
        60 * 60_000,
        () => buildComparison(preset, days)
      );
      return NextResponse.json(res);
    }
    const res = await cached<BacktestResponse>(
      `backtest:${preset}:${days}`,
      60 * 60_000, // ساعة — نتائج الجلسات الماضية لا تتغير خلال اليوم
      () => buildBacktest(preset, days)
    );
    if (clamped) {
      return NextResponse.json({
        ...res,
        notesAr: [
          `نافذة الخطة المجانية ${days} جلسات — الترقية للاحترافية توسعها إلى ${strategyMax}.`,
          ...res.notesAr,
        ],
      });
    }
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("backtest failed:", msg);
    return NextResponse.json(
      { error: "تعذّر تنفيذ الاختبار التاريخي — حاول مجدداً بعد قليل." },
      { status: 502 }
    );
  }
}
