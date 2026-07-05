// تنسيق رسالة واتساب اليومية: إشارات الفلاتر مع خطة كل صفقة والتعليمات.
// دوال نقية — تُختبر بسهولة وتُستخدم من مسار الملخص اليومي وزر المشاركة.

import { ScreenerResponse, StockRow } from "@/lib/types";

const SITE_URL = "https://stocks-platform-seven.vercel.app";

/** أقصى عدد إشارات لكل فلتر في الرسالة (الرسائل الطويلة تُقصّ في واتساب) */
const MAX_PER_FILTER = 5;

function fmtMoney(n: number | null | undefined, cur = "$"): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const num = n.toFixed(2);
  return cur === "$" ? "$" + num : `${num} ${cur}`;
}

/** عملة الرسالة حسب سوق الرمز: تداول (.SR) بالريال وسواه بالدولار */
function curOf(ticker: string): string {
  return ticker.toUpperCase().endsWith(".SR") ? "ر.س" : "$";
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
  const cur = curOf(row.ticker);
  const lines: string[] = [];
  lines.push(`${index}) *${row.ticker}* — ${fmtMoney(row.price, cur)}`);
  if (t && t.targets.length > 0) {
    const t1 = t.targets[0];
    lines.push(`   🎯 الهدف: ${fmtMoney(t1.price, cur)} (${fmtPct(t1.percent)})`);
    if (t.stopLoss !== null) {
      const stopPct = ((t.stopLoss - row.price) / row.price) * 100;
      lines.push(`   🛑 الوقف: ${fmtMoney(t.stopLoss, cur)} (${fmtPct(stopPct)})`);
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

// ------------------------------------------------------------
// التنبيهات اللحظية (يبنيها /api/alerts وترسلها البوابة)
// ------------------------------------------------------------

const DISCLAIMER = "⚠️ فرز آلي — ليست توصية استثمارية.";

export function buildTradeTargetAlert(t: {
  ticker: string;
  entryPrice: number;
  target: number;
  price: number;
}): string {
  const pnl = ((t.price - t.entryPrice) / t.entryPrice) * 100;
  const cur = curOf(t.ticker);
  return [
    `🎯 *بلغت الهدف!*`,
    `سهم *${t.ticker}* لامس هدفك ${fmtMoney(t.target, cur)} (السعر الآن ${fmtMoney(t.price, cur)}).`,
    `دخولك: ${fmtMoney(t.entryPrice, cur)} → الربح الحالي ${fmtPct(pnl)}.`,
    `📌 الخطة: اخرج عند الهدف الأول، أو خذ نصف الربح وارفع الوقف لسعر الدخول.`,
    DISCLAIMER,
  ].join("\n");
}

export function buildTradeStopAlert(t: {
  ticker: string;
  entryPrice: number;
  stop: number;
  price: number;
}): string {
  const cur = curOf(t.ticker);
  return [
    `🛑 *لامس الوقف!*`,
    `سهم *${t.ticker}* نزل إلى وقفك ${fmtMoney(t.stop, cur)} (السعر الآن ${fmtMoney(t.price, cur)}).`,
    `دخولك: ${fmtMoney(t.entryPrice, cur)}.`,
    `📌 الخطة: نفّذ الوقف بلا تردد — حماية رأس المال أولاً.`,
    DISCLAIMER,
  ].join("\n");
}

export function buildTradeNearStopAlert(t: {
  ticker: string;
  entryPrice: number;
  stop: number;
  price: number;
}): string {
  const dist = ((t.price - t.stop) / t.stop) * 100;
  const cur = curOf(t.ticker);
  return [
    `⚠️ *اقترب من الوقف*`,
    `سهم *${t.ticker}* على بعد ${fmtPct(dist).replace("+", "")} من وقفك ${fmtMoney(t.stop, cur)} (السعر الآن ${fmtMoney(t.price, cur)}).`,
    `تأكد أن أمر الوقف قائم في منصة التداول.`,
    DISCLAIMER,
  ].join("\n");
}

export function buildShariahChangeAlert(
  ticker: string,
  oldVerdictAr: string,
  newVerdictAr: string
): string {
  return [
    `🕌 *تغيّر الحكم الشرعي*`,
    `سهم *${ticker}* في قائمة متابعتك تغيّر حكمه:`,
    `${oldVerdictAr} ← *${newVerdictAr}*`,
    `راجع صفحة السهم للتفاصيل ونسبة التطهير.`,
    `⚠️ الفحص الشرعي تقديري بمنهجية أيوفي 21.`,
  ].join("\n");
}

export function buildWatchlistSignalAlert(
  ticker: string,
  presetAr: string,
  row: StockRow | null
): string {
  const lines = [
    `👀 *إشارة على سهم تتابعه*`,
    `سهم *${ticker}* من قائمة متابعتك ظهر اليوم في فلتر «${presetAr}».`,
  ];
  if (row) lines.push(signalBlock(row, 1));
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

export interface WeeklyStats {
  closed: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  avgReturn: number | null;
  best: { ticker: string; pnl: number } | null;
  worst: { ticker: string; pnl: number } | null;
  open: number;
  /** مبلغ التطهير المستحق عن صفقات الأسبوع بالدولار (null = لا يُعرض) */
  purificationUsd?: number | null;
  /** مبلغ التطهير المستحق بالريال (صفقات تداول) */
  purificationSar?: number | null;
}

export function buildWeeklyReport(s: WeeklyStats, now: Date): string {
  const dateAr = now.toLocaleDateString("ar-u-nu-latn", {
    month: "long",
    day: "numeric",
  });
  const parts = [`📈 *تقرير الأسبوع — صفقاتك* (${dateAr})`, ""];
  if (s.closed === 0) {
    parts.push("لم تُغلق أي صفقة هذا الأسبوع.");
    if (s.open > 0) parts.push(`لديك ${s.open} صفقة مفتوحة.`);
  } else {
    parts.push(`الصفقات المغلقة: ${s.closed} — ✅ ${s.wins} رابحة / ❌ ${s.losses} خاسرة`);
    if (s.hitRate !== null) parts.push(`نسبة الإصابة: ${s.hitRate.toFixed(0)}%`);
    if (s.avgReturn !== null) parts.push(`متوسط عائد الصفقة: ${fmtPct(s.avgReturn)}`);
    if (s.best) parts.push(`أفضل صفقة: ${s.best.ticker} ${fmtPct(s.best.pnl)}`);
    if (s.worst) parts.push(`أسوأ صفقة: ${s.worst.ticker} ${fmtPct(s.worst.pnl)}`);
    if (s.open > 0) parts.push(`الصفقات المفتوحة الآن: ${s.open}`);
    const purUsd = s.purificationUsd ?? 0;
    const purSar = s.purificationSar ?? 0;
    if (purUsd > 0 || purSar > 0) {
      const amounts = [
        purUsd > 0 ? fmtMoney(purUsd) : null,
        purSar > 0 ? fmtMoney(purSar, "ر.س") : null,
      ]
        .filter(Boolean)
        .join(" + ");
      parts.push(`🧼 مبلغ التطهير المستحق عن صفقات الأسبوع: ${amounts} — تصدّق به.`);
    }
  }
  parts.push("");
  parts.push(DISCLAIMER);
  return parts.join("\n");
}

/** ملخص السوق السعودي اليومي — يُرسل بعد إغلاق تداول */
export function buildSaudiDigest(
  saudi: ScreenerResponse | null,
  now: Date
): string {
  const dateAr = now.toLocaleDateString("ar-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const parts: string[] = [];
  parts.push(`📊 *سهم سكرينر — السوق السعودي اليوم*`);
  parts.push(dateAr);
  parts.push("");

  if (!saudi || saudi.source === "demo") {
    parts.push("تعذّر جلب بيانات تداول الحية اليوم.");
  } else if (saudi.rows.length === 0) {
    parts.push("لا إشارات زخم في تداول اليوم — الفلاتر الانتقائية تصمت أحياناً، وقد يكون السوق مغلقاً.");
  } else {
    const rows = saudi.rows.slice(0, MAX_PER_FILTER);
    parts.push(
      `🇸🇦 *زخم تداول* (${saudi.total} ${saudi.total === 1 ? "إشارة" : "إشارات"}${
        saudi.total > rows.length ? ` — أقوى ${rows.length}` : ""
      }):`
    );
    rows.forEach((r, i) => parts.push(signalBlock(r, i + 1)));
    parts.push("");
    parts.push("📌 جلسة تداول القادمة: الأحد–الخميس 10:00–15:10 بتوقيت الرياض.");
  }

  parts.push("");
  parts.push("⚠️ فرز آلي — ليست توصية استثمارية، والفحص الشرعي تقديري.");
  parts.push(`التفاصيل والرسوم: ${SITE_URL}/screener?preset=saudi`);
  return parts.join("\n");
}

// ------------------------------------------------------------
// ردود الأوامر التفاعلية (أرسل رمز سهم أو أمراً إلى واتساب المرتبط)
// ------------------------------------------------------------

export function buildHelpReply(): string {
  return [
    `🤖 *أوامر سهم سكرينر عبر واتساب:*`,
    `• أرسل رمز سهم (مثل AAPL أو 2222) → تحليل فوري: الحكم الشرعي والأهداف والوقف`,
    `• *صفقاتي* → صفقاتك المفتوحة مع أسعارها الآن`,
    `• *قائمتي* → قائمة متابعتك بالأسعار والأحكام`,
    `• *ملخص* → إشارات السوق الأمريكي اليوم`,
    `• *تداول* → إشارات السوق السعودي اليوم`,
    `• *تطهير* → مبلغ التطهير المستحق عن صفقاتك`,
    `• *مساعدة* → هذه الرسالة`,
    "",
    DISCLAIMER,
  ].join("\n");
}

export function buildStockReply(input: {
  row: StockRow;
  momentum: { target: number | null; stop: number | null; rr: number | null };
  liquidity: { target: number | null; stop: number | null; rr: number | null };
  purificationRatio: number | null;
  siteUrl?: string;
}): string {
  const { row } = input;
  const cur = curOf(row.ticker);
  const lines = [
    `📊 *${row.ticker}* — ${row.name}`,
    `السعر: ${fmtMoney(row.price, cur)} (${fmtPct(row.changePercent)})`,
    `🕌 الحكم: ${verdictAr(row)}`,
  ];
  if (input.purificationRatio !== null) {
    lines.push(`🧼 نسبة التطهير: ${input.purificationRatio}% من الربح`);
  }
  const strat = (
    label: string,
    t: { target: number | null; stop: number | null; rr: number | null }
  ) => {
    if (t.target === null && t.stop === null) return null;
    const bits = [
      t.target !== null ? `🎯 ${fmtMoney(t.target, cur)}` : null,
      t.stop !== null ? `🛑 ${fmtMoney(t.stop, cur)}` : null,
      t.rr !== null ? `⚖️ ${t.rr.toFixed(2)}` : null,
    ].filter(Boolean);
    return `*${label}:* ${bits.join(" · ")}`;
  };
  const m = strat("الزخم / السوينق", input.momentum);
  const l = strat("صيد السيولة", input.liquidity);
  if (m) lines.push(m);
  if (l) lines.push(l);
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push(`${input.siteUrl ?? SITE_URL}/stock/${row.ticker}`);
  return lines.join("\n");
}

export interface TradeLine {
  ticker: string;
  entryPrice: number;
  target: number;
  stop: number;
  currentPrice: number | null;
}

export function buildTradesReply(rows: TradeLine[]): string {
  if (rows.length === 0) {
    return "لا توجد صفقات مفتوحة في سجلك حالياً.";
  }
  const lines = [`📒 *صفقاتك المفتوحة (${rows.length}):*`];
  rows.forEach((t, i) => {
    const cur = curOf(t.ticker);
    const pnl =
      t.currentPrice !== null
        ? ((t.currentPrice - t.entryPrice) / t.entryPrice) * 100
        : null;
    lines.push(
      `${i + 1}) *${t.ticker}* — دخول ${fmtMoney(t.entryPrice, cur)} → الآن ${fmtMoney(
        t.currentPrice,
        cur
      )} (${fmtPct(pnl)})`
    );
    lines.push(`   🎯 ${fmtMoney(t.target, cur)} · 🛑 ${fmtMoney(t.stop, cur)}`);
  });
  lines.push("");
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

export interface WatchLine {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  verdictAr: string;
}

export function buildWatchlistReply(rows: WatchLine[]): string {
  if (rows.length === 0) {
    return "قائمة متابعتك فارغة — أضف أسهماً من صفحة أي سهم في المنصة.";
  }
  const lines = [`👀 *قائمة متابعتك (${rows.length}):*`];
  rows.forEach((r, i) => {
    lines.push(
      `${i + 1}) *${r.ticker}* — ${fmtMoney(r.price, curOf(r.ticker))} (${fmtPct(r.changePercent)}) · ${r.verdictAr}`
    );
  });
  lines.push("");
  lines.push(DISCLAIMER);
  return lines.join("\n");
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
