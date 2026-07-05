// أدوات تنسيق الأرقام والنصوص للعرض العربي.
// تستخدم الأرقام الغربية (0-9) مع فواصل عربية السياق للوضوح المالي.

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** عملة العرض حسب سوق الرمز: تداول (.SR) بالريال، وسواه بالدولار */
export function currencyFor(ticker: string | null | undefined): string {
  return ticker && ticker.toUpperCase().endsWith(".SR") ? "ر.س" : "$";
}

export function fmtPrice(
  n: number | null | undefined,
  currency = "$"
): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const num = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "$" ? "$" + num : `${num} ${currency}`;
}

export function fmtPercent(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(digits) + "%";
}

/** تنسيق مختصر للأعداد الكبيرة: 1.2M ، 3.4B ، 500K */
export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return nf.format(n / 1e12) + "T";
  if (abs >= 1e9) return nf.format(n / 1e9) + "B";
  if (abs >= 1e6) return nf.format(n / 1e6) + "M";
  if (abs >= 1e3) return nf.format(n / 1e3) + "K";
  return nf0.format(n);
}

/** لون سهم التغير */
export function changeColorClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n) || n === 0) return "text-zinc-500";
  return n > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

export function fmtDateAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
