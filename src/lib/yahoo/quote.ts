// quoteSummary — البيانات الأساسية اللازمة للفحص الشرعي وفلتر الاستثمار.
// كل القيم الرقمية من ياهو تأتي بصيغة {raw, fmt} — نأخذ raw دائماً عبر raw().

import { Fundamentals } from "@/lib/types";
import { cached } from "@/lib/cache";
import { yahooJson } from "@/lib/yahoo/client";

const MODULES =
  "summaryProfile,defaultKeyStatistics,financialData,balanceSheetHistory,incomeStatementHistory,earningsTrend";
const TTL_MS = 6 * 60 * 60 * 1000; // كاش ٦ ساعات

type Dict = Record<string, unknown>;

function asDict(v: unknown): Dict | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Dict) : null;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** يستخرج الرقم من قيمة ياهو سواء كانت رقماً مباشراً أو {raw, fmt} */
function raw(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const d = asDict(v);
  if (d) {
    const r = d.raw;
    if (typeof r === "number" && Number.isFinite(r)) return r;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: unknown[] | null;
    error?: unknown;
  } | null;
}

async function fetchImpl(ticker: string): Promise<Fundamentals | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker
  )}?modules=${MODULES}`;
  const res = await yahooJson<QuoteSummaryResponse>(url, { needsCrumb: true });
  const root = asDict(res.quoteSummary?.result?.[0]);
  if (!root) return null;

  // كل موديول قد يغيب مستقلاً — نتعامل مع كل واحد على حدة
  const profile = asDict(root.summaryProfile);
  const keyStats = asDict(root.defaultKeyStatistics);
  const fin = asDict(root.financialData);
  const bsList = asArr(asDict(root.balanceSheetHistory)?.balanceSheetStatements);
  const isList = asArr(asDict(root.incomeStatementHistory)?.incomeStatementHistory);
  const trendList = asArr(asDict(root.earningsTrend)?.trend);

  const latestBs = asDict(bsList[0]); // ياهو يرتب الأحدث أولاً
  const latestIs = asDict(isList[0]);

  // تاريخ الإيرادات/صافي الدخل — الأقدم أولاً
  const revenueHistory: number[] = [];
  const netIncomeHistory: number[] = [];
  for (let i = isList.length - 1; i >= 0; i--) {
    const st = asDict(isList[i]);
    const rev = raw(st?.totalRevenue);
    const ni = raw(st?.netIncome);
    if (rev !== null) revenueHistory.push(rev);
    if (ni !== null) netIncomeHistory.push(ni);
  }

  // نمو الربحية المتوقع للسنة القادمة من earningsTrend حيث period === "+1y"
  let epsGrowthNextYear: number | null = null;
  for (const t of trendList) {
    const td = asDict(t);
    if (td && str(td.period) === "+1y") {
      epsGrowthNextYear = raw(td.growth);
      break;
    }
  }

  // asOf: endDate لأحدث ميزانية (ISO) وإلا null
  let asOf: string | null = null;
  const endRaw = raw(latestBs?.endDate);
  if (endRaw !== null) {
    asOf = new Date(endRaw * 1000).toISOString();
  } else {
    const fmt = asDict(latestBs?.endDate)?.fmt;
    if (typeof fmt === "string" && fmt.length > 0) asOf = fmt;
  }

  const currentPrice = raw(fin?.currentPrice);
  const sharesOutstanding = raw(keyStats?.sharesOutstanding);
  const trailingEps = raw(keyStats?.trailingEps);
  const d2eRaw = raw(fin?.debtToEquity); // ياهو يعيدها ٪ مثل 154.2

  return {
    ticker,
    sector: str(profile?.sector),
    industry: str(profile?.industry),
    longBusinessSummary: str(profile?.longBusinessSummary),
    // القيمة السوقية غير متاحة ضمن الموديولات المتعاقد عليها — تُشتق من السعر × الأسهم القائمة
    marketCap:
      currentPrice !== null && sharesOutstanding !== null && sharesOutstanding > 0
        ? currentPrice * sharesOutstanding
        : null,
    totalDebt: raw(fin?.totalDebt),
    totalCash: raw(fin?.totalCash),
    shortTermInvestments: raw(latestBs?.shortTermInvestments),
    longTermInvestments: raw(latestBs?.longTermInvestments),
    totalRevenue: raw(fin?.totalRevenue),
    interestIncome: raw(latestIs?.interestIncome),
    interestExpense: raw(latestIs?.interestExpense),
    netIncome: raw(latestIs?.netIncome),
    sharesOutstanding,
    floatShares: raw(keyStats?.floatShares),
    targetMeanPrice: raw(fin?.targetMeanPrice),
    recommendationKey: str(fin?.recommendationKey),
    currentRatio: raw(fin?.currentRatio),
    debtToEquity: d2eRaw !== null ? d2eRaw / 100 : null,
    grossMargins: raw(fin?.grossMargins),
    returnOnEquity: raw(fin?.returnOnEquity),
    trailingPE:
      currentPrice !== null && trailingEps !== null && trailingEps > 0
        ? currentPrice / trailingEps
        : null,
    epsGrowthNextYear,
    earningsGrowthYoY: raw(fin?.earningsGrowth),
    revenueHistory,
    netIncomeHistory,
    asOf,
  };
}

/**
 * جلب الأساسيات مع كاش ٦ ساعات بمفتاح fund:{ticker}.
 * هذه الدالة تحديداً لا ترمي — عند أي فشل تعيد null (الفحص الشرعي يتحول UNKNOWN).
 */
export async function fetchFundamentals(ticker: string): Promise<Fundamentals | null> {
  try {
    return await cached(`fund:${ticker}`, TTL_MS, () => fetchImpl(ticker));
  } catch {
    return null;
  }
}

/** جلب متوازٍ بمحدودية concurrency = 6 */
export async function fetchFundamentalsBatch(
  tickers: string[]
): Promise<Map<string, Fundamentals | null>> {
  const out = new Map<string, Fundamentals | null>();
  const unique = Array.from(new Set(tickers));
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < unique.length) {
      const t = unique[next++];
      if (t === undefined) break;
      out.set(t, await fetchFundamentals(t));
    }
  };

  const workers = Array.from(
    { length: Math.min(6, Math.max(1, unique.length)) },
    () => worker()
  );
  await Promise.all(workers);
  return out;
}
