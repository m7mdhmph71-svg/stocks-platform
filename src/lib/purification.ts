// حساب التطهير من سجل الصفقات — مشترك بين صفحة «تطهير محفظتي»
// والتقرير الأسبوعي وأمر واتساب «تطهير».
//
// المنهجية (تقديرية — انظر إخلاء المسؤولية في المنصة):
//   مبلغ التطهير = الربح المحقق × نسبة التطهير للسهم (الدخل غير المباح ÷
//   الإيراد). يُطهَّر المكسب فقط؛ الصفقة الخاسرة لا تطهير عليها.
//   الأرباح الموزعة (التوزيعات) غير مرصودة في سجل الصفقات فلا تدخل الحساب.
//   النسبة المطبقة هي الحالية (آخر قوائم مالية) — تقريب مقبول لصفقات قريبة.

import { fetchFundamentals } from "@/lib/yahoo/quote";
import { screenShariah } from "@/lib/shariah/screen";
import { ShariahVerdict } from "@/lib/types";

/** الحد الأدنى من حقول الصفقة المطلوبة للحساب (يطابق نموذج Trade) */
export interface ClosedTradeInput {
  id: string;
  ticker: string;
  entryPrice: number;
  exitPrice: number | null;
  qty: number | null;
  closedAt: Date | null;
}

export interface PurificationRow {
  id: string;
  ticker: string;
  closedAt: string | null;
  entryPrice: number;
  exitPrice: number;
  qty: number | null;
  /** الربح المحقق للسهم الواحد */
  profitPerShare: number;
  /** الربح المحقق الكلي (null بلا كمية) */
  profit: number | null;
  verdict: ShariahVerdict;
  /** نسبة التطهير % (null = بيانات غير كافية) */
  purificationRatio: number | null;
  /** مبلغ التطهير للسهم الواحد (0 للصفقة الخاسرة) */
  amountPerShare: number | null;
  /** مبلغ التطهير الكلي (null بلا كمية أو بلا نسبة) */
  amount: number | null;
  /** عملة الصفقة: $ أو ر.س */
  currency: string;
}

export interface PurificationTotals {
  /** إجمالي مستحق التطهير بالدولار (الصفقات الأمريكية) */
  usd: number;
  /** إجمالي مستحق التطهير بالريال (صفقات تداول) */
  sar: number;
  /** صفقات رابحة بلا كمية — لم يُحسب مبلغها الكلي */
  missingQty: number;
  /** صفقات رابحة تعذّرت نسبتها (بيانات غير كافية) */
  unknownRatio: number;
  /** صفقات على أسهم غير متوافقة — يُنبَّه لها */
  nonCompliant: number;
}

export interface PurificationReport {
  rows: PurificationRow[];
  totals: PurificationTotals;
}

function currencyOf(ticker: string): string {
  return ticker.toUpperCase().endsWith(".SR") ? "ر.س" : "$";
}

/**
 * يحسب التطهير لصفقات مغلقة. يجلب نسبة كل رمز مرة واحدة
 * (fetchFundamentals مخبأة 6 ساعات فالكلفة منخفضة).
 */
export async function computePurification(
  trades: ClosedTradeInput[]
): Promise<PurificationReport> {
  const closed = trades.filter((t) => t.exitPrice !== null);

  // نسبة التطهير لكل رمز فريد
  const tickers = Array.from(new Set(closed.map((t) => t.ticker)));
  const ratios = new Map<
    string,
    { ratio: number | null; verdict: ShariahVerdict }
  >();
  for (const ticker of tickers) {
    const fund = await fetchFundamentals(ticker).catch(() => null);
    const sh = screenShariah(fund);
    ratios.set(ticker, { ratio: sh.purificationRatio, verdict: sh.verdict });
  }

  const totals: PurificationTotals = {
    usd: 0,
    sar: 0,
    missingQty: 0,
    unknownRatio: 0,
    nonCompliant: 0,
  };

  const rows: PurificationRow[] = closed.map((t) => {
    const info = ratios.get(t.ticker) ?? { ratio: null, verdict: "UNKNOWN" as const };
    const exitPrice = t.exitPrice as number;
    const profitPerShare = exitPrice - t.entryPrice;
    const profit = t.qty !== null ? profitPerShare * t.qty : null;
    const gainPerShare = Math.max(0, profitPerShare);
    const currency = currencyOf(t.ticker);

    let amountPerShare: number | null = null;
    let amount: number | null = null;
    if (info.ratio !== null) {
      amountPerShare = (gainPerShare * info.ratio) / 100;
      if (t.qty !== null) {
        amount = amountPerShare * t.qty;
        if (currency === "$") totals.usd += amount;
        else totals.sar += amount;
      } else if (gainPerShare > 0) {
        totals.missingQty++;
      }
    } else if (gainPerShare > 0) {
      totals.unknownRatio++;
    }
    if (info.verdict === "NON_COMPLIANT" && gainPerShare > 0) {
      totals.nonCompliant++;
    }

    return {
      id: t.id,
      ticker: t.ticker,
      closedAt: t.closedAt?.toISOString() ?? null,
      entryPrice: t.entryPrice,
      exitPrice,
      qty: t.qty,
      profitPerShare,
      profit,
      verdict: info.verdict,
      purificationRatio: info.ratio,
      amountPerShare,
      amount,
      currency,
    };
  });

  return { rows, totals };
}

/** ملاحظات المنهجية الموحدة — تُعرض في الصفحة والرسائل */
export const PURIFICATION_NOTES_AR: string[] = [
  "مبلغ التطهير = الربح المحقق × نسبة التطهير (الدخل غير المباح ÷ الإيراد) — يُطهَّر المكسب فقط، والصفقة الخاسرة لا تطهير عليها في هذا المنهج.",
  "الأرباح الموزعة (التوزيعات النقدية) غير مرصودة في سجل الصفقات — طهّرها يدوياً بنسبة السهم إن استلمتها.",
  "النسبة المطبقة هي الحالية من آخر القوائم المالية — تقريب مقبول للصفقات القريبة العهد.",
  "السهم «غير المتوافق»: بعض أهل العلم يرى التصدق بكامل ربحه لا بنسبة التطهير فقط — استشر من تثق بعلمه.",
  "⚠️ الحساب تقديري بمنهجية أيوفي 21 وليس فتوى — راجع هيئتك الشرعية.",
];
