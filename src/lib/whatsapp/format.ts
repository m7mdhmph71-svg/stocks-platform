// تنسيق رسالة واتساب اليومية: إشارات الفلاتر مع خطة كل صفقة والتعليمات.
// دوال نقية — تُختبر بسهولة وتُستخدم من مسار الملخص اليومي وزر المشاركة.

import { ScreenerResponse, StockRow } from "@/lib/types";

const SITE_URL = "https://stocks-platform-seven.vercel.app";

/** أقصى عدد إشارات لكل فلتر في الرسالة (الرسائل الطويلة تُقصّ في واتساب) */
const MAX_PER_FILTER = 5;

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return "$" + n.toFixed(2);
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(digits) + "%";
}

function verdictAr(row: StockRow): string {
  const sh = row.shariah;
  if (!sh) return "غير معروف";
  switch (sh.verdict) {
    case "COMPLIANT":
      return "متوافق ✅";
    case "MIXED":
      return `متوافق مع التطهير ${sh.purificationRatio ?? "؟"}% 🟡`;
    case "NON_COMPLIANT":
      return "غير متوافق ❌";
    default:
      return "غير معروف ⚪";
  }
}

function signalBlock(row: StockRow, index: number): string {
  const t = row.targets;
  const lines: string[] = [];
  lines.push(`${index}) *${row.ticker}* — ${fmtMoney(row.price)}`);
  if (t && t.targets.length > 0) {
    const t1 = t.targets[0];
    lines.push(`   🎯 الهدف: ${fmtMoney(t1.price)} (${fmtPct(t1.percent)})`);
    if (t.stopLoss !== null) {
      const stopPct = ((t.stopLoss - row.price) / row.price) * 100;
      lines.push(`   🛑 الوقف: ${fmtMoney(t.stopLoss)} (${fmtPct(stopPct)})`);
    }
    if (t.riskReward !== null) {
      lines.push(`   ⚖️ العائد/المخاطرة: ${t.riskReward.toFixed(2)}`);
    }
  }
  lines.push(`   🕌 ${verdictAr(row)}`);
  return lines.join("\n");
}

export interface DigestInput {
  momentum: ScreenerResponse | null;
  liquidity: ScreenerResponse | null;
}

/** يبني نص رسالة الملخص اليومي الكاملة */
export function buildDailyDigest(input: DigestInput, now: Date): string {
  const dateAr = now.toLocaleDateString("ar-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const parts: string[] = [];
  parts.push(`📊 *سهم سكرينر — إشارات اليوم*`);
  parts.push(dateAr);

  const sections: Array<{
    emoji: string;
    title: string;
    resp: ScreenerResponse | null;
  }> = [
    { emoji: "🚀", title: "الزخم / السوينق", resp: input.momentum },
    { emoji: "⚡", title: "صيد السيولة", resp: input.liquidity },
  ];

  let totalSignals = 0;
  for (const s of sections) {
    parts.push("");
    if (!s.resp || s.resp.source === "demo") {
      parts.push(`${s.emoji} *${s.title}*: تعذّر جلب البيانات الحية اليوم.`);
      continue;
    }
    const rows = s.resp.rows.slice(0, MAX_PER_FILTER);
    totalSignals += s.resp.total;
    if (rows.length === 0) {
      parts.push(`${s.emoji} *${s.title}*: لا إشارات اليوم.`);
      continue;
    }
    parts.push(
      `${s.emoji} *${s.title}* (${s.resp.total} ${s.resp.total === 1 ? "إشارة" : "إشارات"}${
        s.resp.total > rows.length ? ` — أقوى ${rows.length}` : ""
      }):`
    );
    rows.forEach((r, i) => parts.push(signalBlock(r, i + 1)));
  }

  parts.push("");
  if (totalSignals === 0) {
    parts.push("لا توجد إشارات مطابقة اليوم — الفلاتر الانتقائية تصمت أحياناً، وقد يكون السوق مغلقاً.");
  } else {
    parts.push("📌 *تعليمات التنفيذ:*");
    parts.push("• ادخل قرب سعر الإشارة — لا تطارد سعراً ابتعد كثيراً.");
    parts.push("• ضع أمر الوقف فور التنفيذ، قبل أن تفكر في الهدف.");
    parts.push("• اخرج عند الهدف الأول، أو خذ نصف الربح وارفع الوقف لسعر الدخول.");
    parts.push("• الاختبار التاريخي يُظهر أن متوسط حسم الصفقة جلستان — لا تُطِل البقاء.");
    parts.push("• السهم «متوافق مع التطهير»: تصدّق بنسبة التطهير من الربح.");
  }
  parts.push("");
  parts.push("⚠️ فرز آلي — ليست توصية استثمارية، والفحص الشرعي تقديري.");
  parts.push(`التفاصيل والرسوم: ${SITE_URL}/screener`);

  return parts.join("\n");
}

/** رسالة مختصرة لزر «شارك على واتساب» من جدول النتائج */
export function buildShareMessage(
  titleAr: string,
  rows: StockRow[],
  now: Date
): string {
  const dateAr = now.toLocaleDateString("ar-u-nu-latn", {
    month: "long",
    day: "numeric",
  });
  const parts: string[] = [`📊 *${titleAr}* — ${dateAr}`];
  rows.slice(0, MAX_PER_FILTER).forEach((r, i) => parts.push(signalBlock(r, i + 1)));
  parts.push("");
  parts.push("⚠️ فرز آلي — ليست توصية.");
  parts.push(SITE_URL + "/screener");
  return parts.join("\n");
}
