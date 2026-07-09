"use client";

import { useState } from "react";
import { ShariahResult } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { fmtDollar } from "@/components/ui";

/** حاسبة مبلغ التطهير — طريقتا عدد الأسهم والأرباح الموزعة */
export function PurificationCalc({
  shariah,
}: {
  shariah: ShariahResult | null;
}) {
  const [shares, setShares] = useState("");
  const [days, setDays] = useState("365");
  const [dividends, setDividends] = useState("");

  const perShare = shariah?.purificationPerShare ?? null;
  const ratio = shariah?.purificationRatio ?? null;

  // لا يمكن الحساب مطلقاً بدون أي من المعطيين
  if (perShare === null && ratio === null) {
    return (
      <section>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm leading-7 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
          لا يمكن حساب مبلغ التطهير لهذا السهم: تحتاج الحاسبة إلى نسبة التطهير
          أو نصيب السهم من الدخل غير المباح، ولا تتوفر البيانات المالية اللازمة
          لتقديرهما (الإيرادات، الدخل من الفوائد، عدد الأسهم). راجع القوائم
          المالية للشركة أو استشر هيئة شرعية معتمدة.
        </div>
      </section>
    );
  }

  const sharesN = Number(shares);
  const daysN = Number(days);
  const dividendsN = Number(dividends);

  const validShares = shares.trim() !== "" && isFinite(sharesN) && sharesN > 0;
  const validDays = days.trim() !== "" && isFinite(daysN) && daysN > 0;
  const validDividends =
    dividends.trim() !== "" && isFinite(dividendsN) && dividendsN > 0;

  const method1 =
    perShare !== null && validShares && validDays
      ? sharesN * perShare * (daysN / 365)
      : null;

  const method2 =
    ratio !== null && validDividends ? dividendsN * (ratio / 100) : null;

  return (
    <section>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        احسب المبلغ الواجب التصدّق به لتطهير أرباحك من الدخل غير المباح.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            عدد الأسهم
          </span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="مثال: 100"
            className="field tabular-nums"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            أيام الاحتفاظ
          </span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="field tabular-nums"
            dir="ltr"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            الأرباح الموزعة المستلمة $ (اختياري)
          </span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={dividends}
            onChange={(e) => setDividends(e.target.value)}
            placeholder="مثال: 250"
            className="field tabular-nums"
            dir="ltr"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {/* طريقة عدد الأسهم */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            طريقة عدد الأسهم
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {method1 !== null ? fmtDollar(method1) : "—"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {perShare === null
              ? "غير متاحة: لا يتوفر تقدير لنصيب السهم من الدخل غير المباح."
              : !validShares
                ? "أدخل عدد الأسهم لإظهار النتيجة."
                : !validDays
                  ? "أدخل عدد أيام احتفاظ صالحاً."
                  : `عدد الأسهم × ${fmtDollar(
                      perShare
                    )} للسهم سنوياً × (أيام الاحتفاظ ÷ 365).`}
          </p>
        </div>

        {/* طريقة الأرباح الموزعة */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            طريقة الأرباح الموزعة
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {method2 !== null ? fmtDollar(method2) : "—"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {ratio === null
              ? "غير متاحة: لا تتوفر نسبة التطهير لهذا السهم."
              : !validDividends
                ? "أدخل مجموع الأرباح الموزعة المستلمة لإظهار النتيجة."
                : `الأرباح الموزعة × نسبة التطهير ${fmtNum(ratio, 2)}%.`}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-6 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
        عند توفر نتيجتين مختلفتين فإن الأحوط الأخذ بالمبلغ الأكبر منهما. المبالغ
        تقديرية مبنية على آخر قوائم مالية متاحة وليست فتوى.
      </p>
    </section>
  );
}
