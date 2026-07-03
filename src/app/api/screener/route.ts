import { NextRequest, NextResponse } from "next/server";
import {
  FilterCondition,
  ScreenerResponse,
  StockRow,
  StrategyKey,
} from "@/lib/types";
import { PRESETS } from "@/lib/filters/presets";
import { applyConditions, parseConditions } from "@/lib/filters/engine";
import {
  passesLongtermFundamentals,
  passesLongtermTechnicals,
} from "@/lib/filters/longterm";
import { runYahooScreener, CoarseQuery } from "@/lib/yahoo/screener";
import { fetchFundamentalsBatch } from "@/lib/yahoo/quote";
import { fetchCandles } from "@/lib/yahoo/chart";
import { computeTechnicals } from "@/lib/targets/technicals";
import { screenShariah } from "@/lib/shariah/screen";
import { finvizAvailable, fetchFinvizRows } from "@/lib/finviz";
import { demoRows, demoFundamentals } from "@/lib/demo/dataset";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

const PRESET_KEYS: StrategyKey[] = ["liquidity", "momentum", "longterm"];

/** كم مرشحاً نثريه بالبيانات الأساسية كحد أقصى (كلفة الشبكة) */
const ENRICH_CAP = 80;
const LONGTERM_CAP = 400;

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
async function enrichFundamentals(rows: StockRow[]): Promise<StockRow[]> {
  const funds = await fetchFundamentalsBatch(rows.map((r) => r.ticker));
  return rows.map((r) => {
    const f0 = funds.get(r.ticker) ?? null;
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
}

/** إثراء أداء الأسبوع من الشموع لمن يحتاجه */
async function enrichWeekPerf(rows: StockRow[]): Promise<StockRow[]> {
  const out: StockRow[] = [];
  const CONC = 6;
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    const enriched = await Promise.all(
      batch.map(async (r) => {
        if (r.weekPerfPercent !== null) return r;
        const candles = await fetchCandles(r.ticker, "1mo");
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

function demoResponse(
  preset: StrategyKey | "custom",
  conds: FilterCondition[],
  noteAr: string
): ScreenerResponse {
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
  preset: StrategyKey | "custom",
  conds: FilterCondition[]
): Promise<ScreenerResponse> {
  const notesAr: string[] = [];

  // 1) Finviz Elite إن توفر التوكن — يطبّق فلاتر المستخدم حرفياً
  if (preset !== "custom" && finvizAvailable()) {
    const fv = await fetchFinvizRows(PRESETS[preset].finvizQuery);
    if (fv && fv.length > 0) {
      const rows = await enrichFundamentals(fv.slice(0, ENRICH_CAP));
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
  if (preset === "longterm") {
    // تضييق خادمي بالشروط الأساسية القابلة للتفويض — يقلص الكون من آلاف
    // إلى بضع مئات، والبوابة المحلية (passesLongtermFundamentals) تبقى الحاسمة
    coarse.cap = LONGTERM_CAP;
    coarse.peMax = 25;
    coarse.roeMinPct = 10;
    coarse.debtEquityMaxPct = 100;
    coarse.grossMarginMinPct = 0;
  }
  let candidates = await runYahooScreener(coarse);

  if (preset === "longterm") {
    // فلتر الاستثمار: بوابة أساسية ثم فنية
    candidates = candidates.slice(0, LONGTERM_CAP);
    if (candidates.length === LONGTERM_CAP) {
      notesAr.push(
        `تم فحص أعلى ${LONGTERM_CAP} مرشحاً بالحجم من نتائج الفرز الأولي.`
      );
    }
    const funds = await fetchFundamentalsBatch(candidates.map((r) => r.ticker));
    const survivors: StockRow[] = [];
    let withData = 0;
    const failTally = new Map<string, number>();
    for (const r of candidates) {
      const f0 = funds.get(r.ticker) ?? null;
      if (!f0) continue;
      withData++;
      const f = {
        ...f0,
        marketCap: f0.marketCap ?? r.marketCap,
        sharesOutstanding: f0.sharesOutstanding ?? r.sharesOutstanding,
      };
      const gate = passesLongtermFundamentals(f);
      if (!gate.pass) {
        for (const reason of gate.failsAr) {
          failTally.set(reason, (failTally.get(reason) ?? 0) + 1);
        }
        continue;
      }
      survivors.push({
        ...r,
        sector: f.sector,
        industry: f.industry,
        floatShares: f.floatShares,
        marketCap: r.marketCap ?? f.marketCap,
        shariah: screenShariah(f),
      });
    }
    console.log(
      `longterm: candidates=${candidates.length} withData=${withData} passedFundamentals=${survivors.length}`,
      "failTally:",
      Object.fromEntries(failTally)
    );
    if (withData < candidates.length) {
      notesAr.push(
        `توفرت قوائم مالية كاملة لـ ${withData} من ${candidates.length} مرشحاً.`
      );
    }
    // الشروط العادية (السعر/الحجم/الأسهم الحرة) بعد توفر float
    let rows = applyConditions(survivors, conds);
    console.log(
      `longterm: afterConditions=${rows.length}`,
      rows.map((r) => r.ticker).join(",")
    );
    // البوابة الفنية: ضمن 10% من قمة 50 يوم، RSI ≤ 60، فوق SMA200
    const final: StockRow[] = [];
    for (const r of rows) {
      const candles = await fetchCandles(r.ticker, "1y");
      if (candles.length < 200) {
        console.log(`longterm tech: ${r.ticker} candles=${candles.length} → skip`);
        continue;
      }
      const tech = computeTechnicals(candles);
      const gate = passesLongtermTechnicals(r.price, tech);
      if (!gate.pass) {
        console.log(`longterm tech: ${r.ticker} fails: ${gate.failsAr.join("; ")}`);
        continue;
      }
      final.push({ ...r, weekPerfPercent: tech.weekPerfPercent });
    }
    notesAr.push(
      "ملاحظة: نمو 5 سنوات مُقرَّب من آخر 4 سنوات متاحة، وROI مُقرَّب بالعائد على حقوق الملكية (حدود بيانات المصدر المجاني)."
    );
    return {
      preset,
      source: "yahoo",
      asOf: new Date().toISOString(),
      total: final.length,
      rows: final,
      notesAr,
    };
  }

  // مضاربة/زخم/مخصص: فلترة ما هو متاح من بيانات الفرز مباشرة
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
  rows = await enrichFundamentals(rows);
  const floatConds = conds.filter((c) => c.field === "floatShares");
  if (floatConds.length > 0) rows = applyConditions(rows, floatConds);

  // أداء الأسبوع إن كان مطلوباً في الشروط
  const weekConds = conds.filter((c) => c.field === "weekPerfPercent");
  if (weekConds.length > 0) {
    rows = await enrichWeekPerf(rows);
    rows = applyConditions(rows, weekConds);
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

  let preset: StrategyKey | "custom";
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
  } else if ((PRESET_KEYS as string[]).includes(presetParam)) {
    preset = presetParam as StrategyKey;
    conds = PRESETS[preset].conditions;
  } else {
    return NextResponse.json(
      { error: "فلتر غير معروف. الفلاتر المتاحة: liquidity, momentum, longterm, custom." },
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
