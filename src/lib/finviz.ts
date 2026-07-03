// مزوّد Finviz Elite (اختياري) — تصدير CSV عبر export.ashx.
// متاح فقط عند ضبط FINVIZ_AUTH_TOKEN. عند أي فشل يعيد null فيسقط النظام إلى ياهو.

import { StockRow } from "@/lib/types";

const EXPORT_COLUMNS = "0,1,2,3,4,6,24,25,63,64,65,66,67,68";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function finvizAvailable(): boolean {
  const t = process.env.FINVIZ_AUTH_TOKEN;
  return typeof t === "string" && t.trim().length > 0;
}

/** محلّل CSV بسيط يدعم الحقول المقتبسة والفواصل داخل الاقتباس */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  }
  return rows;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** يحوّل قيمة CSV إلى رقم — يتجاهل %، الفواصل، والقيم الفارغة/"-" */
function pnum(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.replace(/[%,\s"]/g, "");
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function pstr(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t.length > 0 && t !== "-" ? t : null;
}

/**
 * GET https://elite.finviz.com/export.ashx?v=152&f={finvizQuery}&auth={token}
 * التحويل بالاعتماد على أسماء أعمدة الترويسة (لا على مواضع ثابتة) — الأعمدة غير
 * المتوفرة تُترك null. وحدات Finviz في التصدير:
 *   Market Cap / Shares Outstanding / Shares Float بالملايين، Average Volume بالآلاف،
 *   Change / Change from Open / Performance (Week) نسب مئوية، Volume و Price كما هي.
 */
export async function fetchFinvizRows(finvizQuery: string): Promise<StockRow[] | null> {
  const token = process.env.FINVIZ_AUTH_TOKEN;
  if (!token || token.trim().length === 0) return null;

  try {
    const url =
      `https://elite.finviz.com/export.ashx?v=152` +
      `&f=${encodeURIComponent(finvizQuery)}` +
      `&c=${EXPORT_COLUMNS}` +
      `&auth=${encodeURIComponent(token.trim())}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
        signal: ctrl.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;

    const text = await res.text();
    // صفحة HTML = توكن غير صالح أو صفحة تسجيل دخول
    if (!text || text.trimStart().startsWith("<")) return null;

    const table = parseCsv(text.trim());
    if (table.length === 0) return null;

    const header = table[0] ?? [];
    const idx = new Map<string, number>();
    header.forEach((h, i) => idx.set(normHeader(h), i));
    if (!idx.has("ticker")) return null;

    const col = (row: string[], ...names: string[]): string | undefined => {
      for (const n of names) {
        const i = idx.get(n);
        if (i !== undefined) return row[i];
      }
      return undefined;
    };

    const rows: StockRow[] = [];
    for (let r = 1; r < table.length; r++) {
      const line = table[r];
      if (!line) continue;

      const ticker = pstr(col(line, "ticker"));
      const price = pnum(col(line, "price"));
      if (!ticker || price === null || price <= 0) continue;

      const mcapM = pnum(col(line, "marketcap"));
      const sharesM = pnum(col(line, "sharesoutstanding", "outstanding"));
      const floatM = pnum(col(line, "sharesfloat", "float"));
      const avgVolK = pnum(col(line, "averagevolume", "avgvolume"));
      const volume = pnum(col(line, "volume"));
      const relVol = pnum(col(line, "relativevolume"));
      const avgVolume3m = avgVolK !== null ? avgVolK * 1000 : null;

      rows.push({
        ticker,
        name: pstr(col(line, "company")) ?? ticker,
        exchange: null,
        sector: pstr(col(line, "sector")),
        industry: pstr(col(line, "industry")),
        price,
        changePercent: pnum(col(line, "change")),
        changeFromOpenPercent: pnum(col(line, "changefromopen", "fromopen")),
        volume,
        avgVolume3m,
        relativeVolume:
          relVol !== null
            ? relVol
            : volume !== null && avgVolume3m !== null && avgVolume3m > 0
              ? volume / avgVolume3m
              : null,
        marketCap: mcapM !== null ? mcapM * 1e6 : null,
        floatShares: floatM !== null ? floatM * 1e6 : null,
        sharesOutstanding: sharesM !== null ? sharesM * 1e6 : null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        weekPerfPercent: pnum(
          col(line, "performanceweek", "perfweek", "performancew")
        ),
        shariah: null,
        targets: null,
      });
    }

    return rows;
  } catch {
    return null;
  }
}
