// عناصر وأدوات مشتركة صغيرة للواجهة.

/** تنسيق تاريخ ووقت بالعربية مع أرقام غربية (0-9) */
export function fmtDateTimeAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("ar-u-nu-latn", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** تنسيق تاريخ قصير للمحاور بأرقام غربية */
export function fmtShortDateAr(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  try {
    return d.toLocaleDateString("ar-u-nu-latn", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

/** وقت قصير للمحاور اللحظية (ساعة:دقيقة بأرقام غربية) */
export function fmtTimeAr(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  try {
    return d.toLocaleTimeString("ar-u-nu-latn", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }
}

/** شهر وسنة للمحاور طويلة المدى (٥ سنوات فأكثر) */
export function fmtMonthYearAr(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  try {
    return d.toLocaleDateString("ar-u-nu-latn", {
      month: "short",
      year: "2-digit",
    });
  } catch {
    return `${d.getMonth() + 1}/${d.getFullYear() % 100}`;
  }
}

/** مبلغ دولاري بدقة مناسبة للقيم الصغيرة (مبالغ التطهير) */
export function fmtDollar(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 1 ? 4 : 2;
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    })
  );
}

/** جلب JSON مع معالجة شكل الخطأ {error} القادم من الـ API */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err =
      data !== null && typeof data === "object" && "error" in data
        ? (data as { error?: unknown }).error
        : null;
    throw new Error(
      typeof err === "string" && err.length > 0
        ? err
        : "تعذّر الاتصال بالخادم — يرجى المحاولة لاحقاً."
    );
  }
  return data as T;
}

/** عنوان قسم موحّد */
export function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {children}
      </h2>
      {sub ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{sub}</p>
      ) : null}
    </div>
  );
}
