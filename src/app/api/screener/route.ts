import { NextRequest, NextResponse } from "next/server";
import {
  FilterCondition,
  ScreenerPresetKey,
  ScreenerResponse,
  StockRow,
  StrategyKey,
} from "@/lib/types";
import { PRESETS } from "@/lib/filters/presets";
import { SAUDI_PRESET } from "@/lib/filters/saudi";
import { TREND_PRESET, passesTrendTechnicals } from "@/lib/filters/trend";
import { saudiNameAr } from "@/lib/saudi/companies";
import { applyConditions, parseConditions } from "@/lib/filters/engine";
import { runYahooScreener, CoarseQuery } from "@/lib/yahoo/screener";
import { fetchFundamentalsBatch } from "@/lib/yahoo/quote";
import { fetchCandles } from "@/lib/yahoo/chart";
import { computeTechnicals } from "@/lib/targets/technicals";
import { computeTargets } from "@/lib/targets/engine";
import { screenShariah } from "@/lib/shariah/screen";
import { finvizAvailable, fetchFinvizRows } from "@/lib/finviz";
import { demoRows, demoFundamentals } from "@/lib/demo/dataset";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

const PRESET_KEYS: StrategyKey[] = ["liquidity", "trend"];

/** كم مرشحاً نثريه بالبيانات الأساسية كحد أقصى (كلفة الشبكة) */
const ENRICH_CAP = 80;

/** استخراج استعلام خشن لياهو من الشروط المحلية (الحقول المدعومة فقط) */
function coarseFromConditions(conds: FilterCondition[]): CoarseQuery {
  const q: CoarseQuery = { size: 250 };
  for (const c of conds) {
    const num = typeof c.value === "number" ? c.value : null;
    const range = Array.isArray(c.value) ? c.value : null;
    switch (c.field) {
      case "price":
        if (c.op === "btwn" && range) {
          q.priceMin = range[0];
          q.priceMax = range[1];
        } else if ((c.op === "gt" || c.op === "gte") && num !== null) {
          q.priceMin = num;
        } else if ((c.op === "lt" || c.op === "lte") && num !== null) {
          q.priceMax = num;
        }
        break;
      case "volume":
        if ((c.op === "gt" || c.op === "gte") && num !== null) q.volumeMin = num;
        break;
      case "avgVolume3m":
        if ((c.op === "gt" || c.op === "gte") && num !== null) q.avgVolumeMin = num;
        break;
      case "marketCap":
        if ((c.op === "gt" || c.op === "gte") && num !== null) q.marketCapMin = num;
        break;
      case "changePercent":
        if (c.op === "btwn" && range) {
          q.changePercentMin = range[0];
          q.changePercentMax = range[1];
        } else if ((c.op === "gt" || c.op === "gte") && num !== null) {
          q.changePercentMin = num;
        } else if ((c.op === "lt" || c.op === "lte") && num !== null) {
          q.changePercentMax = num;
        }
        break;
      default:
        break;
    }
  }
  return q;
}

/** إثراء صفوف بالبيانات الأساسية: القطاع، الأسهم الحرة، والفحص الشرعي.
 * تُرقَّع القيمة السوقية وعدد الأسهم من بيانات الفرز عند غيابها في القوائم
 * كي لا يتحول الفحص الشرعي إلى UNKNOWN بلا داعٍ. */
async function enrichFundamentals(
  rows: StockRow[]
): Promise<{ rows: StockRow[]; missing: number }> {
  const funds = await fetchFundamentalsBatch(rows.map((r) => r.ticker));
  let missing = 0;
  const enriched = rows.map((r) => {
    const f0 = funds.get(r.ticker) ?? null;
    if (!f0) missing++;
    const f = f0
      ? {
          ...f0,
          marketCap: f0.marketCap ?? r.marketCap,
          sharesOutstanding: f0.sharesOutstanding ?? r.sharesOutstanding,
        }
      : null;
    return {
      ...r,
      sector: r.sector ?? f?.sector ?? null,
      industry: r.industry ?? f?.industry ?? null,
      floatShares: r.floatShares ?? f?.floatShares ?? null,
      marketCap: r.marketCap ?? f?.marketCap ?? null,
      shariah: screenShariah(f),
    };
  });
  return { rows: enriched, missing };
}

/** إثراء أداء الأسبوع من الشموع لمن يحتاجه (3 أشهر — نفس كاش إثراء الأهداف) */
async function enrichWeekPerf(rows: StockRow[]): Promise<StockRow[]> {
  const out: StockRow[] = [];
  const CONC = 6;
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    const enriched = await Promise.all(
      batch.map(async (r) => {
        if (r.weekPerfPercent !== null) return r;
        const candles = await fetchCandles(r.ticker, "3mo");
        if (candles.length >= 6) {
          const last = candles[candles.length - 1].close;
          const ref = candles[candles.length - 6].close;
          if (ref > 0) {
            return { ...r, weekPerfPercent: ((last - ref) / ref) * 100 };
          }
        }
        return r;
      })
    );
    out.push(...enriched);
  }
  return out;
}

/** كم صفاً نحسب له الأهداف والدرجة في نتائج الفرز (كلفة شموع إضافية) */
const TARGETS_CAP = 40;

/** إثراء الأهداف ودرجة الفرصة لأعلى الصفوف — تظهر في جدول النتائج */
async function enrichTargets(
  rows: StockRow[],
  strategy: StrategyKey
): Promise<StockRow[]> {
  const out: StockRow[] = [];
  const CONC = 6;
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    const enriched = await Promise.all(
      batch.map(async (r, j) => {
        if (i + j >= TARGETS_CAP || r.targets !== null) return r;
        const candles = await fetchCandles(r.ticker, "3mo");
        if (candles.length < 20) return r;
        const tech = computeTechnicals(candles);
        return {
          ...r,
          weekPerfPercent: r.weekPerfPercent ?? tech.weekPerfPercent,
          targets: computeTargets(strategy, r.price, tech, null),
        };
      })
    );
    out.push(...enriched);
  }
  return out;
}

function demoResponse(
  preset: ScreenerPresetKey,
  conds: FilterCondition[],
  noteAr: string
): ScreenerResponse {
  // لا بيانات تجريبية للسوق السعودي — استجابة فارغة مفسَّرة بدل أسهم أمريكية مضللة
  if (preset === "saudi" || preset === "saudi-trend") {
    return {
      preset,
      source: "demo",
      asOf: new Date().toISOString(),
      total: 0,
      rows: [],
      notesAr: [noteAr, "لا تتوفر بيانات تجريبية للسوق السعودي."],
    };
  }
  let rows =
    preset === "custom" ? demoRows("all") : demoRows(preset as StrategyKey);
  rows = applyConditions(rows, conds).map((r) => ({
    ...r,
    shariah: r.shariah ?? screenShariah(demoFundamentals(r.ticker)),
  }));
  return {
    preset,
    source: "demo",
    asOf: new Date().toISOString(),
    total: rows.length,
    rows,
    notesAr: [
      noteAr,
      "هذه بيانات تجريبية للعرض فقط — ليست أسعاراً حقيقية.",
    ],
  };
}

async function screenLive(
  preset: ScreenerPresetKey,
  conds: FilterCondition[]
): Promise<ScreenerResponse> {
  const notesAr: string[] = [];

  // 1) Finviz Elite إن توفر التوكن — يطبّق فلاتر المستخدم حرفياً
  //    (أمريكي فقط — لا يغطي تداول)
  if (
    preset !== "custom" &&
    preset !== "saudi" &&
    preset !== "trend" &&
    preset !== "saudi-trend" &&
    finvizAvailable()
  ) {
    const fv = await fetchFinvizRows(PRESETS[preset].finvizQuery);
    if (fv && fv.length > 0) {
      const { rows } = await enrichFundamentals(fv.slice(0, ENRICH_CAP));
      return {
        preset,
        source: "finviz",
        asOf: new Date().toISOString(),
        total: rows.length,
        rows,
        notesAr: ["المصدر: Finviz Elite — الفلتر مطبَّق بصيغته الأصلية."],
      };
    }
    notesAr.push("تعذّر جلب بيانات Finviz — تم التحويل إلى Yahoo Finance.");
  }

  // 2) ياهو: فرز خشن (بترقيم صفحات لتغطية كل النتائج) ثم فلترة دقيقة محلياً
  const coarse = coarseFromConditions(conds);
  if (preset === "saudi") coarse.region = "sa";

  // «الاتجاه الصاعد»: كون جودة وسيولة ثم بوابة فنية على شموع سنة
  // (يخدم السوقين: trend للأمريكي وsaudi-trend لتداول)
  if (preset === "trend" || preset === "saudi-trend") {
    if (preset === "saudi-trend") {
      coarse.region = "sa";
      // كون الجودة السعودي: أحجام تداول أدنى من الأمريكي
      coarse.priceMin = 5;
      coarse.avgVolumeMin = 100_000;
      coarse.marketCapMin = 1_000_000_000; // مليار ريال
    }
    coarse.cap = 400;
    let candidates = await runYahooScreener(coarse);
    candidates = candidates.slice(0, 400);
    if (preset === "saudi-trend") {
      candidates = candidates.map((r) => ({
        ...r,
        name: saudiNameAr(r.ticker) ?? r.name,
      }));
    }
    const final: StockRow[] = [];
    const CONC = 6;
    for (let i = 0; i < candidates.length && final.length < 60; i += CONC) {
      const batch = candidates.slice(i, i + CONC);
      const gated = await Promise.all(
        batch.map(async (r) => {
          const candles = await fetchCandles(r.ticker, "1y");
          if (candles.length < 200) return null;
          const tech = computeTechnicals(candles);
          if (!passesTrendTechnicals(r.price, tech).pass) return null;
          return {
            ...r,
            weekPerfPercent: tech.weekPerfPercent,
            targets: computeTargets("trend", r.price, tech, null),
          };
        })
      );
      for (const g of gated) if (g) final.push(g);
    }
    // الفحص الشرعي للناجين فقط (عادة عشرات لا مئات)
    const enriched = await enrichFundamentals(final);
    notesAr.push(
      `فُحص فنياً ${Math.min(candidates.length, 400)} مرشحاً من كون الجودة والسيولة — اجتاز البوابة ${enriched.rows.length}.`,
      "المصدر: Yahoo Finance (فرز مخصص + بيانات أساسية)."
    );
    return {
      preset,
      source: "yahoo",
      asOf: new Date().toISOString(),
      total: enriched.rows.length,
      rows: enriched.rows,
      notesAr,
    };
  }

  let candidates = await runYahooScreener(coarse);
  if (preset === "saudi") {
    // الاسم العربي من فهرس تداول متى توفر
    candidates = candidates.map((r) => ({
      ...r,
      name: saudiNameAr(r.ticker) ?? r.name,
    }));
  }

  // السيولة/المخصص: فلترة ما هو متاح من بيانات الفرز مباشرة
  const preFloatConds = conds.filter(
    (c) => c.field !== "floatShares" && c.field !== "weekPerfPercent"
  );
  let rows = applyConditions(candidates, preFloatConds);
  if (rows.length > ENRICH_CAP) {
    notesAr.push(
      `طابق ${rows.length} سهماً الشروط الأولية — تم إثراء أعلى ${ENRICH_CAP} بالحجم.`
    );
    rows = rows.slice(0, ENRICH_CAP);
  }

  // إثراء الأسهم الحرة + الشرعية
  const enrichedResult = await enrichFundamentals(rows);
  rows = enrichedResult.rows;
  const floatConds = conds.filter((c) => c.field === "floatShares");
  if (enrichedResult.missing > 0) {
    notesAr.push(
      `تعذّر جلب القوائم المالية لـ ${enrichedResult.missing} من ${rows.length} سهماً` +
        (floatConds.length > 0
          ? " — قد تنقص النتائج لأن شرط الأسهم الحرة يتطلبها."
          : " — فحصها الشرعي «غير معروف».")
    );
  }
  if (floatConds.length > 0) rows = applyConditions(rows, floatConds);

  // أداء الأسبوع إن كان مطلوباً في الشروط
  const weekConds = conds.filter((c) => c.field === "weekPerfPercent");
  if (weekConds.length > 0) {
    rows = await enrichWeekPerf(rows);
    rows = applyConditions(rows, weekConds);
  }

  // الأهداف ودرجة الفرصة للنتائج النهائية (المخصص والسعودي بمنطق السيولة)
  rows = await enrichTargets(
    rows,
    preset === "custom" || preset === "saudi" ? "liquidity" : preset
  );
  if (rows.length > TARGETS_CAP) {
    notesAr.push(`حُسبت الأهداف والدرجة لأعلى ${TARGETS_CAP} نتيجة.`);
  }

  notesAr.push("المصدر: Yahoo Finance (فرز مخصص + بيانات أساسية).");
  return {
    preset,
    source: "yahoo",
    asOf: new Date().toISOString(),
    total: rows.length,
    rows,
    notesAr,
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const presetParam = sp.get("preset") ?? "liquidity";

  let preset: ScreenerPresetKey;
  let conds: FilterCondition[];

  if (presetParam === "custom") {
    preset = "custom";
    try {
      conds = parseConditions(JSON.parse(sp.get("conditions") ?? "[]"));
    } catch {
      conds = [];
    }
    if (conds.length === 0) {
      return NextResponse.json(
        { error: "لم تُحدَّد شروط صالحة للفلتر المخصص." },
        { status: 400 }
      );
    }
  } else if (presetParam === "saudi") {
    preset = "saudi";
    conds = SAUDI_PRESET.conditions;
  } else if (presetParam === "trend") {
    preset = "trend";
    conds = TREND_PRESET.conditions;
  } else if (presetParam === "saudi-trend") {
    preset = "saudi-trend";
    conds = []; // الكون السعودي يُحدد داخل فرع الاتجاه مباشرة
  } else if ((PRESET_KEYS as string[]).includes(presetParam)) {
    preset = presetParam as StrategyKey;
    conds = PRESETS[preset as Exclude<StrategyKey, "trend">].conditions;
  } else {
    return NextResponse.json(
      { error: "فلتر غير معروف. الفلاتر المتاحة: liquidity, trend, saudi, saudi-trend, custom." },
      { status: 400 }
    );
  }

  const cacheKey =
    "screener:" +
    (preset === "custom"
      ? "custom:" + JSON.stringify(conds)
      : preset);

  try {
    const res = await cached<ScreenerResponse>(cacheKey, 90_000, () =>
      screenLive(preset, conds)
    );
    return NextResponse.json(res);
  } catch (e) {
    // سقوط كامل للمصدر الحي → بيانات تجريبية كي تبقى المنصة قابلة للاستخدام
    const msg = e instanceof Error ? e.message : String(e);
    console.error("screener live failed:", msg);
    return NextResponse.json(
      demoResponse(
        preset,
        conds,
        "تعذّر الوصول لمصدر البيانات الحي — تم عرض بيانات تجريبية."
      )
    );
  }
}
