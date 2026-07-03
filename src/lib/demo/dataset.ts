// بيانات تجريبية حتمية بالكامل — تُستخدم عند تعذّر الوصول لمصادر البيانات الحية.
// لا Date.now() ولا Math.random() يؤثران على القيم: مولّد mulberry32 مزروع من hash(الرمز)
// ومرساة زمنية ثابتة، فتتطابق النتائج بين كل استدعاء وكل عملية خادم.

import { Candle, Fundamentals, StockRow, StrategyKey } from "@/lib/types";

// ---------------------------------------------------------------
// مولّد عشوائية حتمي
// ---------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

// ---------------------------------------------------------------
// مواصفات الأسهم الوهمية (36 سهماً)
// ---------------------------------------------------------------

type Regime = "spike" | "swing" | "steadyUp" | "down" | "sideways";
type Profile = "clean" | "mixed" | "highDebt" | "bank" | "brewer" | "casino" | "unknown";
type Group = "liquidity" | "momentum" | "longterm" | "other";

interface DemoSpec {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  price: number;
  changePercent: number;
  changeFromOpenPercent: number;
  weekPerfPercent: number;
  volume: number;
  avgVolume3m: number;
  floatShares: number;
  sharesOutstanding: number;
  regime: Regime;
  profile: Profile;
  group: Group;
  /** نسبة الدخل الربوي من الإيراد ٪ (لحالات MIXED) */
  purificationPct?: number;
}

function sp(
  ticker: string,
  name: string,
  exchange: string,
  sector: string,
  industry: string,
  price: number,
  changePercent: number,
  changeFromOpenPercent: number,
  weekPerfPercent: number,
  volume: number,
  avgVolume3m: number,
  floatShares: number,
  sharesOutstanding: number,
  regime: Regime,
  profile: Profile,
  group: Group,
  purificationPct?: number
): DemoSpec {
  return {
    ticker, name, exchange, sector, industry, price, changePercent,
    changeFromOpenPercent, weekPerfPercent, volume, avgVolume3m,
    floatShares, sharesOutstanding, regime, profile, group, purificationPct,
  };
}

const M = 1_000_000;

const SPECS: DemoSpec[] = [
  // —— مجموعة «صيد السيولة» (سعر 1-10، تعويم < 50M، تغير من الافتتاح > 10%) ——
  sp("DEMO1", "Falcon Bio Labs Inc.", "NASDAQ", "Healthcare", "Biotechnology", 4.62, 7.8, 24.5, 9.4, 18.4 * M, 2.1 * M, 21.5 * M, 26 * M, "spike", "clean", "liquidity"),
  sp("DEMO2", "Crescent Micro Devices", "NASDAQ", "Technology", "Semiconductors", 2.35, -3.2, 15.6, -4.2, 9.7 * M, 1.4 * M, 12.8 * M, 15.5 * M, "spike", "clean", "liquidity"),
  sp("DEMO3", "Oasis Therapeutics Corp.", "NASDAQ", "Healthcare", "Biotechnology", 7.18, 9.1, 12.4, 6.8, 5.2 * M, 0.9 * M, 34 * M, 41 * M, "spike", "mixed", "liquidity", 2.6),
  sp("DEMO4", "Dune Energy Systems", "NYSE", "Energy", "Oil & Gas Equipment & Services", 1.84, 4.4, 31.0, 14.6, 42.6 * M, 3.8 * M, 47.2 * M, 55 * M, "spike", "clean", "liquidity"),
  sp("DEMO5", "Sahara Robotics Holdings", "NASDAQ", "Industrials", "Specialty Industrial Machinery", 5.93, -6.8, 18.2, -7.9, 3.9 * M, 0.75 * M, 18.9 * M, 22 * M, "spike", "clean", "liquidity"),
  sp("DEMO6", "Palm Grove Foods Co.", "NYSE", "Consumer Defensive", "Packaged Foods", 3.41, 2.9, 11.2, 3.2, 2.7 * M, 0.64 * M, 27.6 * M, 33 * M, "spike", "clean", "liquidity"),
  sp("DEMO7", "Ibis Media Networks", "NASDAQ", "Communication Services", "Broadcasting", 6.47, 8.6, 14.9, 8.1, 7.8 * M, 1.9 * M, 42.3 * M, 51 * M, "spike", "highDebt", "liquidity"),
  sp("DEMO8", "Mirage Quantum Inc.", "NASDAQ", "Technology", "Software—Infrastructure", 9.12, 5.5, 10.8, 2.4, 1.9 * M, 0.62 * M, 8.4 * M, 10.2 * M, "spike", "clean", "liquidity"),
  sp("DEMO9", "Cedar Marine Logistics", "NYSE", "Industrials", "Marine Shipping", 2.78, -1.7, 20.3, -3.6, 11.3 * M, 2.6 * M, 36.7 * M, 44 * M, "spike", "clean", "liquidity"),
  sp("DEMO10", "Aster Genomics Ltd.", "NASDAQ", "Healthcare", "Diagnostics & Research", 1.29, 6.3, 27.7, 12.3, 25.1 * M, 4.4 * M, 44.9 * M, 52 * M, "spike", "clean", "liquidity"),
  sp("DEMO11", "Zephyr Aviation Parts", "NYSE", "Industrials", "Aerospace & Defense", 8.05, 3.8, 13.5, 5.7, 1.6 * M, 0.54 * M, 15.2 * M, 18 * M, "spike", "clean", "liquidity"),

  // —— مجموعة «الزخم / السوينق» (تعويم > 20M، حجم نسبي > 1، أداء أسبوع > 10%) ——
  sp("DEMO12", "Nile Cloud Analytics", "NASDAQ", "Technology", "Software—Application", 6.84, 6.2, 8.4, 18.6, 4.6 * M, 1.7 * M, 58 * M, 66 * M, "swing", "clean", "momentum"),
  sp("DEMO13", "Atlas Copper Mining Co.", "NYSE", "Basic Materials", "Copper", 3.52, 4.8, 6.7, 12.9, 8.9 * M, 3.2 * M, 120 * M, 138 * M, "swing", "clean", "momentum"),
  sp("DEMO14", "Pearl Coast Hotels Group", "NYSE", "Consumer Cyclical", "Lodging", 5.27, 7.4, 9.8, 21.4, 2.8 * M, 1.1 * M, 36 * M, 42 * M, "swing", "mixed", "momentum", 1.4),
  sp("DEMO15", "Horizon EV Motors", "NASDAQ", "Consumer Cyclical", "Auto Manufacturers", 2.19, 8.9, 12.6, 34.7, 31.5 * M, 9.8 * M, 210 * M, 240 * M, "swing", "clean", "momentum"),
  sp("DEMO16", "Bedouin Solar Corp.", "NASDAQ", "Technology", "Solar", 4.05, 5.1, 7.2, 15.3, 6.3 * M, 2.9 * M, 74 * M, 85 * M, "swing", "clean", "momentum"),
  sp("DEMO17", "Qamar Pharma Inc.", "NASDAQ", "Healthcare", "Drug Manufacturers—Specialty & Generic", 7.61, 3.4, 5.9, 11.8, 1.8 * M, 0.83 * M, 29 * M, 34 * M, "swing", "clean", "momentum"),
  sp("DEMO18", "Coral Bay Seafoods", "NYSE", "Consumer Defensive", "Farm Products", 1.73, 9.4, 11.1, 27.2, 14.2 * M, 5.1 * M, 96 * M, 110 * M, "swing", "clean", "momentum"),
  sp("DEMO19", "Meridian Freight Lines", "NYSE", "Industrials", "Trucking", 8.44, 2.6, 6.1, 13.5, 1.3 * M, 0.61 * M, 47 * M, 55 * M, "swing", "highDebt", "momentum"),
  sp("DEMO20", "Lotus AI Systems", "NASDAQ", "Technology", "Information Technology Services", 9.37, 7.7, 8.8, 24.1, 5.7 * M, 1.6 * M, 63 * M, 72 * M, "swing", "clean", "momentum"),
  sp("DEMO21", "Amber Grid Storage", "NYSE", "Utilities", "Utilities—Renewable", 3.96, 4.2, 5.6, 16.9, 3.4 * M, 1.5 * M, 88 * M, 101 * M, "swing", "clean", "momentum"),
  sp("DEMO22", "Kite Surf Apparel Co.", "NYSE", "Consumer Cyclical", "Apparel Retail", 6.12, 6.8, 7.9, 19.8, 2.2 * M, 0.94 * M, 25 * M, 30 * M, "swing", "clean", "momentum"),

  // —— مجموعة «الاستثمار طويل المدى» (قيمة سوقية ≥ 300M، تعويم > 50M، سعر > 5) ——
  sp("DEMO23", "Anchor Semiconductor Corp.", "NASDAQ", "Technology", "Semiconductors", 84.3, 1.2, 0.6, 3.1, 3.1 * M, 2.8 * M, 480 * M, 510 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO24", "Granite Health Partners", "NYSE", "Healthcare", "Medical Devices", 56.75, 0.8, 0.4, 2.2, 1.9 * M, 1.7 * M, 210 * M, 225 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO25", "Summit Consumer Brands", "NYSE", "Consumer Defensive", "Household & Personal Products", 38.42, -0.5, 0.3, 1.4, 2.4 * M, 2.2 * M, 340 * M, 360 * M, "steadyUp", "mixed", "longterm", 3.6),
  sp("DEMO26", "Blue Falcon Aerospace", "NYSE", "Industrials", "Aerospace & Defense", 112.6, 1.6, 0.9, 4.0, 1.2 * M, 1.1 * M, 150 * M, 160 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO27", "Verdant Agritech PLC", "NYSE", "Basic Materials", "Agricultural Inputs", 27.85, 0.9, 0.5, 2.8, 3.6 * M, 3.3 * M, 420 * M, 450 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO28", "Northstar Retail Group", "NYSE", "Consumer Cyclical", "Discount Stores", 63.18, 1.1, 0.7, 3.4, 2.1 * M, 1.9 * M, 275 * M, 290 * M, "steadyUp", "mixed", "longterm", 1.7),
  sp("DEMO29", "Ironwood Software Inc.", "NASDAQ", "Technology", "Software—Application", 145.9, 2.1, 1.2, 5.2, 1.7 * M, 1.5 * M, 95 * M, 102 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO30", "First Meridian Bancorp", "NYSE", "Financial Services", "Banks—Regional", 41.27, 0.4, 0.2, 1.1, 1.4 * M, 1.3 * M, 130 * M, 140 * M, "steadyUp", "bank", "longterm"),
  sp("DEMO31", "Cypress Medical Labs", "NASDAQ", "Healthcare", "Diagnostics & Research", 72.49, 1.4, 0.8, 3.7, 0.94 * M, 0.87 * M, 88 * M, 95 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO32", "Redwood Industrial Gases", "NYSE", "Basic Materials", "Specialty Chemicals", 96.34, 0.6, 0.3, 2.5, 1.1 * M, 1.0 * M, 180 * M, 195 * M, "steadyUp", "clean", "longterm"),
  sp("DEMO33", "Silver Dune Telecom", "NYSE", "Communication Services", "Telecom Services", 19.76, 0.7, 0.4, 1.9, 5.8 * M, 5.4 * M, 720 * M, 780 * M, "steadyUp", "clean", "longterm"),

  // —— حالات خاصة للفحص الشرعي ——
  sp("DEMO34", "Golden Barrel Brewing Co.", "NYSE", "Consumer Defensive", "Beverages—Brewers", 14.85, -1.2, -0.8, -2.4, 0.82 * M, 0.9 * M, 45 * M, 52 * M, "down", "brewer", "other"),
  sp("DEMO35", "Mirage Palms Resorts", "NYSE", "Consumer Cyclical", "Resorts & Casinos", 33.6, 2.4, 1.5, 4.6, 1.6 * M, 1.4 * M, 110 * M, 120 * M, "sideways", "casino", "other"),
  sp("DEMO36", "Sandpiper Ventures Inc.", "NASDAQ", "Industrials", "Conglomerates", 11.2, 0.3, 0.1, 0.9, 0.61 * M, 0.58 * M, 30 * M, 38 * M, "sideways", "unknown", "other"),
];

const SPEC_BY_TICKER = new Map<string, DemoSpec>(SPECS.map((s) => [s.ticker, s]));

export function isDemoTicker(ticker: string): boolean {
  return SPEC_BY_TICKER.has(ticker.toUpperCase());
}

// ---------------------------------------------------------------
// الشموع — 260 يوم تداول تنتهي عند مرساة ثابتة (حتمية تامة)
// ---------------------------------------------------------------

const N_CANDLES = 260;
const ANCHOR_MS = Date.UTC(2026, 6, 2, 20, 0, 0); // 2026-07-02 20:00 UTC — ثابتة

const TIMES: number[] = (() => {
  const times: number[] = [];
  let t = ANCHOR_MS;
  while (times.length < N_CANDLES) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) times.push(Math.floor(t / 1000));
    t -= 86_400_000;
  }
  return times.reverse();
})();

/** معاملات الانجراف والتذبذب حسب نظام الحركة وموضع الشمعة (0..1) */
function regimeParams(regime: Regime, frac: number): { drift: number; vol: number } {
  switch (regime) {
    case "spike": // عرضي/هابط ثم انفجار حديث — نمط أسهم المضاربة
      if (frac < 0.5) return { drift: -0.0012, vol: 0.028 };
      if (frac < 0.85) return { drift: 0.0004, vol: 0.03 };
      return { drift: 0.004, vol: 0.045 };
    case "swing": // تجميع ثم موجة صاعدة حديثة
      if (frac < 0.6) return { drift: -0.0002, vol: 0.024 };
      if (frac < 0.85) return { drift: 0.0018, vol: 0.026 };
      return { drift: 0.005, vol: 0.032 };
    case "steadyUp": // صعود هادئ مع تصحيح متوسط — نمط الأسهم الاستثمارية
      if (frac < 0.45) return { drift: 0.0011, vol: 0.013 };
      if (frac < 0.6) return { drift: -0.0006, vol: 0.015 };
      return { drift: 0.0012, vol: 0.013 };
    case "down":
      return { drift: -0.0018, vol: 0.022 };
    case "sideways":
      return { drift: 0, vol: 0.016 };
  }
}

function buildCandles(spec: DemoSpec): Candle[] {
  const rnd = mulberry32(hashString(spec.ticker));
  const n = N_CANDLES;

  // 1) مسار لوغاريتمي حسب النظام
  const closes: number[] = new Array<number>(n);
  closes[0] = 1;
  for (let i = 1; i < n; i++) {
    const { drift, vol } = regimeParams(spec.regime, i / (n - 1));
    const shock = (rnd() + rnd() + rnd() - 1.5) / 1.5; // شبه جرسي في [-1,1]
    closes[i] = closes[i - 1] * Math.exp(drift + shock * vol);
  }

  // 2) تثبيت إغلاق «قبل 5 جلسات» بحيث يطابق weekPerf المعلن ثم جسر حتمي للنهاية
  const anchorIdx = n - 6;
  const weekAnchor = spec.price / (1 + spec.weekPerfPercent / 100);
  const scale = weekAnchor / closes[anchorIdx];
  for (let i = 0; i < n; i++) closes[i] *= scale;

  const prevClose = spec.price / (1 + spec.changePercent / 100);
  for (let k = 1; k <= 3; k++) {
    const noise = 1 + (rnd() - 0.5) * 0.02;
    closes[anchorIdx + k] =
      weekAnchor * Math.pow(prevClose / weekAnchor, k / 4) * noise;
  }
  closes[n - 2] = prevClose;
  closes[n - 1] = spec.price; // إغلاق آخر شمعة = سعر الصف تماماً

  // 3) الافتتاحات — فجوات صغيرة، وآخر يوم متسق مع changeFromOpenPercent
  const opens: number[] = new Array<number>(n);
  opens[0] = closes[0] * (1 + (rnd() - 0.5) * 0.01);
  for (let i = 1; i < n; i++) {
    opens[i] = closes[i - 1] * (1 + (rnd() - 0.5) * 0.012);
  }
  opens[n - 1] = spec.price / (1 + spec.changeFromOpenPercent / 100);

  // 4) بناء الشموع: قمم/قيعان متسقة وحجوم مرتبطة بحجم الحركة
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const o = opens[i];
    const c = closes[i];
    const top = Math.max(o, c);
    const bottom = Math.min(o, c);
    const { vol } = regimeParams(spec.regime, i / (n - 1));
    const high = top * (1 + rnd() * vol * 0.6);
    const low = Math.max(bottom * (1 - rnd() * vol * 0.6), 0.01);

    const prev = i > 0 ? closes[i - 1] : o;
    const move =
      Math.abs(c / prev - 1) + Math.abs(o > 0 ? c / o - 1 : 0);
    const volume =
      i === n - 1
        ? Math.round(spec.volume)
        : Math.max(
            1000,
            Math.round(spec.avgVolume3m * (0.45 + rnd() * 0.9) * (1 + 7 * move))
          );

    out.push({
      time: TIMES[i],
      open: round4(o),
      high: round4(high),
      low: round4(low),
      close: round4(c),
      volume,
    });
  }
  return out;
}

const candleMemo = new Map<string, Candle[]>();

function getCandles(ticker: string): Candle[] {
  const spec = SPEC_BY_TICKER.get(ticker.toUpperCase());
  if (!spec) return [];
  let c = candleMemo.get(spec.ticker);
  if (!c) {
    c = buildCandles(spec);
    candleMemo.set(spec.ticker, c);
  }
  return c;
}

/** 260 شمعة يومية حتمية للرمز — [] لرمز غير تجريبي */
export function demoCandles(ticker: string): Candle[] {
  return getCandles(ticker).map((c) => ({ ...c }));
}

// ---------------------------------------------------------------
// الصفوف
// ---------------------------------------------------------------

function makeRow(spec: DemoSpec): StockRow {
  const candles = getCandles(spec.ticker);
  const last252 = candles.slice(-252);
  let hi52 = -Infinity;
  let lo52 = Infinity;
  for (const c of last252) {
    if (c.high > hi52) hi52 = c.high;
    if (c.low < lo52) lo52 = c.low;
  }

  const marketCap =
    spec.profile === "unknown"
      ? null
      : Math.round(spec.price * spec.sharesOutstanding);

  return {
    ticker: spec.ticker,
    name: spec.name,
    exchange: spec.exchange,
    sector: spec.sector,
    industry: spec.industry,
    price: spec.price,
    changePercent: spec.changePercent,
    changeFromOpenPercent: spec.changeFromOpenPercent,
    volume: Math.round(spec.volume),
    avgVolume3m: Math.round(spec.avgVolume3m),
    relativeVolume:
      spec.avgVolume3m > 0 ? round2(spec.volume / spec.avgVolume3m) : null,
    marketCap,
    floatShares: Math.round(spec.floatShares),
    sharesOutstanding: Math.round(spec.sharesOutstanding),
    fiftyTwoWeekHigh: Number.isFinite(hi52) ? hi52 : null,
    fiftyTwoWeekLow: Number.isFinite(lo52) ? lo52 : null,
    weekPerfPercent: spec.weekPerfPercent,
    shariah: null,
    targets: null,
  };
}

/** شروط كل استراتيجية رقمياً كما في PRESETS (منسوخة هنا لتجنب اعتماد دائري بين الوحدات) */
function passesPreset(r: StockRow, preset: StrategyKey): boolean {
  const { price, volume, avgVolume3m, floatShares, relativeVolume, marketCap } = r;
  const cfo = r.changeFromOpenPercent;
  const chg = r.changePercent;
  const week = r.weekPerfPercent;

  switch (preset) {
    case "liquidity":
      return (
        volume !== null && volume > 500_000 &&
        floatShares !== null && floatShares < 50 * M &&
        price >= 1 && price <= 10 &&
        cfo !== null && cfo > 10 &&
        chg !== null && chg >= -10 && chg <= 10
      );
    case "momentum":
      return (
        volume !== null && volume > 500_000 &&
        floatShares !== null && floatShares > 20 * M &&
        price >= 1 && price <= 10 &&
        relativeVolume !== null && relativeVolume > 1 &&
        cfo !== null && cfo > 5 &&
        week !== null && week > 10
      );
    case "longterm":
      return (
        marketCap !== null && marketCap >= 300 * M &&
        avgVolume3m !== null && avgVolume3m > 500_000 &&
        floatShares !== null && floatShares > 50 * M &&
        price > 5
      );
  }
}

/** صفوف تجريبية: "all" = الكل، وإلا الصفوف المحققة فعلاً لشروط الاستراتيجية */
export function demoRows(preset: StrategyKey | "all"): StockRow[] {
  const rows = SPECS.map(makeRow);
  const filtered =
    preset === "all" ? rows : rows.filter((r) => passesPreset(r, preset));
  return filtered.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

// ---------------------------------------------------------------
// الأساسيات (للفحص الشرعي وفلتر الاستثمار)
// ---------------------------------------------------------------

const FUND_AS_OF = "2025-12-31T00:00:00.000Z";

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
}

function buildFundamentals(spec: DemoSpec): Fundamentals {
  const summary = `شركة تجريبية لأغراض العرض فقط، تعمل في مجال ${spec.industry} ضمن قطاع ${spec.sector}.`;

  // حالة البيانات الناقصة → UNKNOWN في الفحص الشرعي
  if (spec.profile === "unknown") {
    return {
      ticker: spec.ticker,
      sector: spec.sector,
      industry: spec.industry,
      longBusinessSummary: summary,
      marketCap: null,
      totalDebt: null,
      totalCash: null,
      shortTermInvestments: null,
      longTermInvestments: null,
      totalRevenue: null,
      interestIncome: null,
      interestExpense: null,
      netIncome: null,
      sharesOutstanding: Math.round(spec.sharesOutstanding),
      floatShares: Math.round(spec.floatShares),
      targetMeanPrice: null,
      recommendationKey: null,
      currentRatio: null,
      debtToEquity: null,
      grossMargins: null,
      returnOnEquity: null,
      trailingPE: null,
      epsGrowthNextYear: null,
      earningsGrowthYoY: null,
      revenueHistory: [],
      netIncomeHistory: [],
      asOf: null,
    };
  }

  const rnd = mulberry32(hashString(spec.ticker + "|fund"));
  const mcap = Math.round(spec.price * spec.sharesOutstanding);
  const isLong = spec.group === "longterm";
  const p = spec.profile;

  const revenue = Math.round(mcap * (isLong ? 0.35 + rnd() * 0.45 : 0.22 + rnd() * 0.5));

  // الدين الربوي كنسبة من القيمة السوقية (الحد الشرعي 30%)
  let debtFrac: number;
  if (p === "clean") debtFrac = 0.05 + rnd() * 0.15; // 5-20% ✓
  else if (p === "mixed") debtFrac = 0.08 + rnd() * 0.14; // 8-22% ✓
  else if (p === "highDebt") debtFrac = 0.38 + rnd() * 0.14; // 38-52% ✗
  else if (p === "bank") debtFrac = 1.1 + rnd() * 0.7;
  else debtFrac = 0.18 + rnd() * 0.1; // brewer / casino
  const totalDebt = Math.round(mcap * debtFrac);

  const totalCash = Math.round(mcap * (p === "bank" ? 0.28 : 0.05 + rnd() * 0.1));
  const shortTermInvestments = Math.round(mcap * (p === "bank" ? 0.22 : rnd() * 0.05));
  const longTermInvestments = Math.round(mcap * (p === "bank" ? 0.15 : rnd() * 0.04));

  // الدخل الربوي: 0 للنظيف، 1-4% من الإيراد للمختلط، مهيمن للبنك
  let interestIncome: number;
  if (p === "clean") interestIncome = 0;
  else if (p === "mixed") interestIncome = Math.round((revenue * (spec.purificationPct ?? 2)) / 100);
  else if (p === "highDebt") interestIncome = Math.round(revenue * 0.005);
  else if (p === "bank") interestIncome = Math.round(revenue * 0.62);
  else interestIncome = Math.round(revenue * 0.004);

  let margin: number;
  if (p === "bank") margin = 0.24;
  else if (p === "brewer" || p === "casino") margin = 0.08 + rnd() * 0.08;
  else if (isLong) margin = 0.09 + rnd() * 0.1;
  else if (spec.group === "momentum") margin = 0.02 + rnd() * 0.12;
  else margin = -0.12 + rnd() * 0.24; // مضاربة: قد تكون خاسرة
  const netIncome = Math.round(revenue * margin);

  // تواريخ 4 سنوات (الأقدم أولاً) — نموّ موجب مضمون لأسهم الاستثمار
  let growth: number;
  if (isLong) growth = 0.09 + rnd() * 0.07;
  else if (spec.group === "momentum") growth = 0.05 + rnd() * 0.18;
  else if (spec.group === "liquidity") growth = -0.04 + rnd() * 0.2;
  else growth = 0.02 + rnd() * 0.05;
  const niGrowth = growth + 0.03;
  const revenueHistory = [3, 2, 1, 0].map((k) =>
    Math.round(revenue / Math.pow(1 + growth, k))
  );
  const netIncomeHistory = [3, 2, 1, 0].map((k) =>
    Math.round(netIncome / Math.pow(1 + niGrowth, k))
  );

  const currentRatio =
    p === "bank" ? round2(1.05 + rnd() * 0.2)
    : isLong ? round2(1.5 + rnd() * 1.1)
    : round2(0.9 + rnd() * 1.1);

  const debtToEquity =
    p === "highDebt" ? round2(1.4 + rnd() * 0.8)
    : p === "bank" ? round2(2.2 + rnd() * 1.2)
    : isLong ? round2(0.25 + rnd() * 0.5)
    : round2(0.3 + rnd() * 0.9);

  const grossMargins = p === "bank" ? 0.5 : isLong ? 0.35 + rnd() * 0.25 : 0.2 + rnd() * 0.35;

  const returnOnEquity =
    p === "bank" ? 0.11
    : isLong ? 0.12 + rnd() * 0.14
    : netIncome < 0 ? -(0.05 + rnd() * 0.15)
    : 0.06 + rnd() * 0.2;

  const trailingPE =
    netIncome > 0 ? round2(isLong ? 13 + rnd() * 9 : 12 + rnd() * 45) : null;

  return {
    ticker: spec.ticker,
    sector: spec.sector,
    industry: spec.industry,
    longBusinessSummary: summary,
    marketCap: mcap,
    totalDebt,
    totalCash,
    shortTermInvestments,
    longTermInvestments,
    totalRevenue: revenue,
    interestIncome,
    interestExpense: Math.round(totalDebt * 0.05),
    netIncome,
    sharesOutstanding: Math.round(spec.sharesOutstanding),
    floatShares: Math.round(spec.floatShares),
    targetMeanPrice: round2(spec.price * (isLong ? 1.12 + rnd() * 0.22 : 1.05 + rnd() * 0.4)),
    recommendationKey: pick(rnd, ["strong_buy", "buy", "buy", "hold"] as const),
    currentRatio,
    debtToEquity,
    grossMargins: round2(grossMargins * 100) / 100,
    returnOnEquity: round2(returnOnEquity * 100) / 100,
    trailingPE,
    epsGrowthNextYear: round2((isLong ? 0.06 + rnd() * 0.12 : -0.15 + rnd() * 0.5) * 100) / 100,
    earningsGrowthYoY: round2((isLong ? 0.08 + rnd() * 0.2 : -0.2 + rnd() * 0.6) * 100) / 100,
    revenueHistory,
    netIncomeHistory,
    asOf: FUND_AS_OF,
  };
}

/** أساسيات تجريبية حتمية — null لرمز غير تجريبي */
export function demoFundamentals(ticker: string): Fundamentals | null {
  const spec = SPEC_BY_TICKER.get(ticker.toUpperCase());
  if (!spec) return null;
  return buildFundamentals(spec);
}
