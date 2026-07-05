import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { searchSaudi } from "@/lib/saudi/companies";

export const dynamic = "force-dynamic";

/** بحث الأسهم بالاسم أو الرمز — يغذي صندوق البحث بالاقتراحات.
 * يدمج مصدرين: فهرس شركات تداول المحلي (يفهم العربية: «أرامكو»، «الراجحي»،
 * والرموز الرقمية مثل 2222) وبحث ياهو العالمي. */

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  isUS: boolean;
  /** سهم سوق تداول السعودي (.SR) */
  isSaudi: boolean;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const US_EXCHANGES = new Set([
  "NASDAQ",
  "NYSE",
  "NYSEArca",
  "AMEX",
  "NYSE American",
  "CBOE",
  "BATS",
]);

async function searchYahoo(q: string): Promise<SearchResult[]> {
  const url =
    "https://query1.finance.yahoo.com/v1/finance/search?q=" +
    encodeURIComponent(q) +
    "&quotesCount=12&newsCount=0&listsCount=0";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`yahoo search: ${res.status}`);
  const j = (await res.json()) as {
    quotes?: Array<Record<string, unknown> | null> | null;
  };

  const out: SearchResult[] = [];
  for (const raw of j.quotes ?? []) {
    if (!raw) continue;
    if (raw.quoteType !== "EQUITY") continue;
    const ticker = typeof raw.symbol === "string" ? raw.symbol : null;
    const name =
      (typeof raw.shortname === "string" && raw.shortname) ||
      (typeof raw.longname === "string" && raw.longname) ||
      null;
    const exchange = typeof raw.exchDisp === "string" ? raw.exchDisp : "";
    if (!ticker || !name) continue;
    out.push({
      ticker,
      name,
      exchange,
      isUS: US_EXCHANGES.has(exchange),
      isSaudi: ticker.toUpperCase().endsWith(".SR"),
    });
  }
  return out;
}

/** هل الاستعلام عربي أو رمز تداول رقمي؟ عندها تتصدر نتائج السوق السعودي */
function looksSaudiFirst(q: string): boolean {
  return /[؀-ۿ]/.test(q) || /^\d{1,4}$/.test(q);
}

async function combinedSearch(q: string): Promise<SearchResult[]> {
  // الفهرس المحلي لتداول (فوري، يفهم العربية)
  const local: SearchResult[] = searchSaudi(q).map((c) => ({
    ticker: c.code + ".SR",
    name: c.nameAr,
    exchange: "تداول",
    isUS: false,
    isSaudi: true,
  }));

  // ياهو العالمي — فشله لا يسقط البحث كله
  let yahoo: SearchResult[] = [];
  try {
    yahoo = await searchYahoo(q);
  } catch {
    // نكتفي بالنتائج المحلية
  }

  // ترتيب ياهو: الأسواق المدعومة أولاً (الأمريكية ثم السعودية ثم الباقي)
  const rank = (r: SearchResult) => (r.isUS ? 2 : r.isSaudi ? 1 : 0);
  yahoo.sort((a, b) => rank(b) - rank(a));

  // الدمج مع إزالة التكرار: بالعربية/الأرقام تتصدر تداول، وإلا ياهو أولاً
  const first = looksSaudiFirst(q) ? local : yahoo;
  const second = looksSaudiFirst(q) ? yahoo : local;
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...first, ...second]) {
    if (seen.has(r.ticker)) continue;
    seen.add(r.ticker);
    merged.push(r);
  }
  return merged.slice(0, 8);
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 40) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await cached(
      `search:${q.toLowerCase()}`,
      10 * 60_000,
      () => combinedSearch(q)
    );
    return NextResponse.json({ results });
  } catch (e) {
    console.error("search failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ results: [] });
  }
}
