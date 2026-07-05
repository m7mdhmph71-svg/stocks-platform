// فرز ياهو المخصص — POST v1/finance/screener (فرز خشن على مستوى الخادم)
// Yahoo custom screener: coarse server-side filtering, normalized to StockRow[].

import { StockRow } from "@/lib/types";
import { yahooJson } from "@/lib/yahoo/client";

export interface CoarseQuery {
  /** سوق الفرز: us (الافتراضي) أو sa (تداول السعودية) */
  region?: "us" | "sa";
  priceMin?: number;
  priceMax?: number;
  /** dayvolume */
  volumeMin?: number;
  /** avgdailyvol3m */
  avgVolumeMin?: number;
  marketCapMin?: number;
  changePercentMin?: number;
  changePercentMax?: number;

  // — شروط أساسية خادمية (تضييق تقريبي للكون؛ البوابة المحلية هي الحاسمة) —
  /** مكرر الربحية بين 0 وهذه القيمة */
  peMax?: number;
  /** العائد على حقوق الملكية أدنى (٪ — مثال 10 تعني 10%) */
  roeMinPct?: number;
  /** الدين/حقوق الملكية أقصى (٪ — مثال 100 تعني نسبة 1.0) */
  debtEquityMaxPct?: number;
  /** هامش الربح الإجمالي أدنى (٪) */
  grossMarginMinPct?: number;
  /** حجم الصفحة الواحدة — default 100, max 250 */
  size?: number;
  /**
   * أقصى عدد صفوف إجمالي عبر ترقيم الصفحات (offset pagination).
   * الفلاتر الدقيقة (كالتغير من الافتتاح) تُطبَّق محلياً لاحقاً، لذا
   * يجب تغطية كامل نتائج الفرز الخشن لا أول صفحة فقط. default 750.
   */
  cap?: number;
}

interface RuleOperand {
  operator: string;
  operands: Array<string | number | RuleOperand>;
}

interface RawScreenerResponse {
  finance?: {
    result?: Array<{
      start?: number;
      count?: number;
      total?: number;
      quotes?: Array<Record<string, unknown> | null> | null;
    } | null> | null;
    error?: { code?: string; description?: string } | null;
  } | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** يبني معاملات الاستعلام — مقيّد بسوق واحد (us افتراضياً) */
function buildOperands(q: CoarseQuery): RuleOperand[] {
  const ops: RuleOperand[] = [
    { operator: "eq", operands: ["region", q.region ?? "us"] },
  ];

  if (q.priceMin !== undefined && q.priceMax !== undefined) {
    ops.push({ operator: "btwn", operands: ["intradayprice", q.priceMin, q.priceMax] });
  } else if (q.priceMin !== undefined) {
    ops.push({ operator: "gte", operands: ["intradayprice", q.priceMin] });
  } else if (q.priceMax !== undefined) {
    ops.push({ operator: "lte", operands: ["intradayprice", q.priceMax] });
  }

  if (q.volumeMin !== undefined) {
    ops.push({ operator: "gt", operands: ["dayvolume", q.volumeMin] });
  }
  if (q.avgVolumeMin !== undefined) {
    ops.push({ operator: "gt", operands: ["avgdailyvol3m", q.avgVolumeMin] });
  }
  if (q.marketCapMin !== undefined) {
    ops.push({ operator: "gte", operands: ["intradaymarketcap", q.marketCapMin] });
  }

  if (q.changePercentMin !== undefined && q.changePercentMax !== undefined) {
    ops.push({
      operator: "btwn",
      operands: ["percentchange", q.changePercentMin, q.changePercentMax],
    });
  } else if (q.changePercentMin !== undefined) {
    ops.push({ operator: "gt", operands: ["percentchange", q.changePercentMin] });
  } else if (q.changePercentMax !== undefined) {
    ops.push({ operator: "lt", operands: ["percentchange", q.changePercentMax] });
  }

  if (q.peMax !== undefined) {
    ops.push({
      operator: "btwn",
      operands: ["peratio.lasttwelvemonths", 0, q.peMax],
    });
  }
  if (q.roeMinPct !== undefined) {
    ops.push({
      operator: "gt",
      operands: ["returnonequity.lasttwelvemonths", q.roeMinPct],
    });
  }
  if (q.debtEquityMaxPct !== undefined) {
    ops.push({
      operator: "lt",
      operands: ["totaldebtequity.lasttwelvemonths", q.debtEquityMaxPct],
    });
  }
  if (q.grossMarginMinPct !== undefined) {
    ops.push({
      operator: "gt",
      operands: ["grossprofitmargin.lasttwelvemonths", q.grossMarginMinPct],
    });
  }

  return ops;
}

/**
 * ينفّذ الفرز المخصص ويعيد صفوفاً مُطبَّعة.
 * أخطاء الشبكة/الاستجابة تُرمى — المستدعي يتعامل معها (سقوط إلى demo).
 */
export async function runYahooScreener(q: CoarseQuery): Promise<StockRow[]> {
  const size = Math.max(1, Math.min(250, Math.floor(q.size ?? 100)));
  const cap = Math.max(size, Math.min(1500, Math.floor(q.cap ?? 750)));

  const quotes: Array<Record<string, unknown> | null> = [];
  let offset = 0;
  let total = Infinity;

  while (offset < Math.min(total, cap)) {
    const body = {
      size: Math.min(size, cap - offset),
      offset,
      sortField: "dayvolume",
      sortType: "DESC",
      quoteType: "EQUITY",
      query: { operator: "and", operands: buildOperands(q) },
      userId: "",
      userIdType: "guid",
    };

    const res = await yahooJson<RawScreenerResponse>(
      "https://query1.finance.yahoo.com/v1/finance/screener?formatted=false",
      { needsCrumb: true, method: "POST", body }
    );

    if (res.finance?.error) {
      const e = res.finance.error;
      throw new Error(`yahoo screener error: ${e.description ?? e.code ?? "unknown"}`);
    }
    const result = res.finance?.result?.[0];
    if (!result) {
      // أول صفحة فارغة = خطأ فعلي؛ صفحة لاحقة فارغة = انتهت النتائج
      if (offset === 0) throw new Error("yahoo screener: empty result");
      break;
    }

    const page = result.quotes ?? [];
    quotes.push(...page);
    total = typeof result.total === "number" ? result.total : quotes.length;
    if (page.length === 0) break;
    offset += page.length;
  }

  const rows: StockRow[] = [];
  const seen = new Set<string>();

  for (const raw of quotes) {
    if (!raw) continue;
    const symbol = str(raw.symbol);
    const price = num(raw.regularMarketPrice);
    if (!symbol || price === null || price <= 0) continue;
    if (seen.has(symbol)) continue;
    seen.add(symbol);

    const qt = str(raw.quoteType);
    if (qt !== null && qt !== "EQUITY") continue;

    if ((q.region ?? "us") === "us") {
      // استبعاد الوارنت/الوحدات/حقوق الاكتتاب — لا تظهر في فرز الأسهم العادية:
      // عرف ناسداك: الحرف الخامس W=وارنت، R=حقوق، U=وحدة SPAC؛
      // ولواحق نيويورك: .WS / -WT / .U / -UN / -RT
      if (/^[A-Z]{4}[WRU]$/.test(symbol)) continue;
      if (/[.-](WS|WT|U|UN|RT|R|W)$/.test(symbol)) continue;

      // استبعاد أسهم OTC (خارج كون Finviz: بورصات NYSE/Nasdaq/AMEX فقط)
      const exchCode = str(raw.exchange);
      const exchName = str(raw.fullExchangeName) ?? "";
      if (exchCode === "PNK" || /OTC|Pink/i.test(exchName)) continue;
    } else {
      // السوق السعودي: أسهم تداول فقط (لاحقة .SR) — استبعاد صناديق المؤشرات
      if (!symbol.endsWith(".SR")) continue;
    }

    const open = num(raw.regularMarketOpen);
    const volume = num(raw.regularMarketVolume);
    const avgVolume3m = num(raw.averageDailyVolume3Month);

    rows.push({
      ticker: symbol,
      name: str(raw.shortName) ?? str(raw.longName) ?? symbol,
      exchange: str(raw.fullExchangeName),
      sector: null,
      industry: null,
      price,
      changePercent: num(raw.regularMarketChangePercent),
      changeFromOpenPercent:
        open !== null && open > 0 ? ((price - open) / open) * 100 : null,
      volume,
      avgVolume3m,
      relativeVolume:
        volume !== null && avgVolume3m !== null && avgVolume3m > 0
          ? volume / avgVolume3m
          : null,
      marketCap: num(raw.marketCap),
      floatShares: null, // تُثرى لاحقاً من quoteSummary
      sharesOutstanding: num(raw.sharesOutstanding),
      fiftyTwoWeekHigh: num(raw.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(raw.fiftyTwoWeekLow),
      weekPerfPercent: null, // تُثرى لاحقاً من بيانات الشموع
      shariah: null,
      targets: null,
    });
  }

  return rows;
}
