"use client";

// صفحة «تنبيهاتي»: ربط واتساب من داخل المنصة (رمز QR من البوابة المحلية)
// + تفضيلات أنواع التنبيهات لكل مستخدم + شرح الأوامر التفاعلية.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { fetchJson } from "@/components/ui";
import type { GatewayStatusResponse } from "@/app/api/whatsapp/gateway/route";
import type { NotifyPrefsPayload } from "@/app/api/whatsapp/prefs/route";

async function postAction(
  action: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/whatsapp/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok
      ? { ok: true }
      : { ok: false, error: data.error ?? "تعذّر تنفيذ الإجراء." };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم." };
  }
}

const TOGGLES: Array<{
  key: keyof Omit<NotifyPrefsPayload, "whatsappPhone">;
  label: string;
  hint: string;
}> = [
  {
    key: "alertTrades",
    label: "تنبيهات الصفقات",
    hint: "عند لمس صفقة مفتوحة للهدف، أو اقترابها من الوقف أو لمسه",
  },
  {
    key: "alertWatchlist",
    label: "إشارات قائمة المتابعة",
    hint: "عندما يظهر سهم تتابعه في فلتر الزخم أو صيد السيولة",
  },
  {
    key: "alertShariah",
    label: "تغيّر الحكم الشرعي",
    hint: "عندما يتغير حكم سهم في قائمة متابعتك (متوافق ↔ مختلط ↔ غير متوافق)",
  },
  {
    key: "weeklyReport",
    label: "تقرير الأسبوع",
    hint: "ملخص أداء صفقاتك كل سبت: نسبة الإصابة ومتوسط العائد وأفضل وأسوأ صفقة",
  },
];

const COMMANDS: Array<{ cmd: string; desc: string }> = [
  { cmd: "AAPL", desc: "أرسل أي رمز سهم (أو رقم تداول مثل 2222) → تحليل فوري: الحكم الشرعي والأهداف والوقف" },
  { cmd: "صفقاتي", desc: "صفقاتك المفتوحة بأسعارها الحالية" },
  { cmd: "قائمتي", desc: "قائمة متابعتك بالأسعار والأحكام" },
  { cmd: "ملخص", desc: "إشارات السوق الأمريكي اليوم" },
  { cmd: "تداول", desc: "إشارات السوق السعودي اليوم" },
  { cmd: "تطهير", desc: "مبلغ التطهير المستحق عن صفقاتك المغلقة" },
  { cmd: "مساعدة", desc: "قائمة الأوامر" },
];

export function WhatsAppClient() {
  const session = useSession();
  const [status, setStatus] = useState<GatewayStatusResponse | null>(null);
  const [prefs, setPrefs] = useState<NotifyPrefsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(() => {
    fetchJson<GatewayStatusResponse>("/api/whatsapp/gateway")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // حالة البوابة: تحديث كل ٥ ثوانٍ أثناء انتظار المسح، وكل ٣٠ ثانية بعد الربط
  useEffect(() => {
    if (!session.user) return;
    loadStatus();
    const interval = status?.connected ? 30_000 : 5_000;
    pollRef.current = setInterval(loadStatus, interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session.user, status?.connected, loadStatus]);

  // التفضيلات: تحميل مرة واحدة
  useEffect(() => {
    if (!session.user) return;
    fetchJson<NotifyPrefsPayload>("/api/whatsapp/prefs")
      .then(setPrefs)
      .catch(() => setPrefs(null));
  }, [session.user]);

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/whatsapp/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice(
        res.ok
          ? { ok: true, text: "حُفظت التفضيلات." }
          : { ok: false, text: data.error ?? "تعذّر الحفظ." }
      );
    } catch {
      setNotice({ ok: false, text: "تعذّر الاتصال بالخادم." });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setNotice(null);
    const r = await postAction(action);
    setBusy(null);
    setNotice(
      r.ok
        ? {
            ok: true,
            text:
              action === "test"
                ? "أُرسلت الرسالة التجريبية — تفقد واتسابك."
                : action === "digest"
                  ? "أُرسل ملخص اليوم — قد يستغرق بناؤه دقيقة."
                  : "فُصل الربط — امسح الرمز الجديد لإعادة الربط.",
          }
        : { ok: false, text: r.error ?? "خطأ." }
    );
    loadStatus();
  }

  if (session.loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (!session.enabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            الحسابات غير مفعّلة على هذا النشر
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            تنبيهات واتساب تتطلب حساباً — تتفعل تلقائياً على النشر بقاعدة
            بيانات.
          </p>
        </div>
      </div>
    );
  }

  if (!session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            سجّل الدخول أولاً
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            تنبيهات واتساب مرتبطة بحسابك: صفقاتك وقائمة متابعتك وتفضيلاتك.
          </p>
          <Link href="/account" className="btn-primary mt-6 inline-block px-6 py-2">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          تنبيهات واتساب
        </h1>
        <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          اربط واتسابك مرة واحدة، فتصلك إشارات اليوم تلقائياً وتنبيهات
          صفقاتك لحظة لمس الهدف أو الوقف، وتغيّر الحكم الشرعي لأسهم
          متابعتك — ويمكنك سؤال المنصة عن أي سهم برسالة واتساب.
        </p>
      </header>

      {notice ? (
        <p
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (notice.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")
          }
        >
          {notice.text}
        </p>
      ) : null}

      {/* حالة الربط */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">حالة الربط</h2>

        {status === null ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : !status.enabled ? (
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            بوابة واتساب غير مضبوطة على هذا النشر (ميزة النسخة المحلية
            والخادم الخاص). اضبط <code dir="ltr">GATEWAY_URL</code> في متغيرات
            البيئة وشغّل البوابة من مجلد <code dir="ltr">gateway/</code>.
          </p>
        ) : !status.reachable ? (
          <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            <p>
              ⏳ تعذّر الوصول إلى البوابة — شغّلها على جهازك ثم عُد لهذه
              الصفحة:
            </p>
            <pre
              dir="ltr"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
            >
              cd gateway && npm start
            </pre>
          </div>
        ) : status.connected ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              ✅ واتساب مرتبط
              {status.selfJid ? (
                <span className="ms-2 text-xs text-zinc-500" dir="ltr">
                  ({status.selfJid.split("@")[0]})
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runAction("test")}
                disabled={busy !== null}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy === "test" ? "جارٍ الإرسال…" : "أرسل رسالة تجريبية"}
              </button>
              <button
                type="button"
                onClick={() => runAction("digest")}
                disabled={busy !== null}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                {busy === "digest" ? "جارٍ البناء…" : "أرسل ملخص اليوم الآن"}
              </button>
              <button
                type="button"
                onClick={() =>
                  runAction(
                    "logout",
                    "سيُفصل ربط واتساب وتحتاج مسح رمز QR من جديد — متأكد؟"
                  )
                }
                disabled={busy !== null}
                className="ms-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                فصل الربط
              </button>
            </div>
          </div>
        ) : status.qr ? (
          <div className="mt-3 flex flex-col items-center gap-3 text-center">
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              من جوالك: <b>واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</b>{" "}
              ثم امسح الرمز:
            </p>
            {/* رمز QR يصل data URL من البوابة عبر الوسيط — عنصر img عادي مقصود */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.qr}
              alt="رمز QR لربط واتساب"
              className="h-64 w-64 rounded-xl border-8 border-white shadow-md"
              style={{ imageRendering: "pixelated" }}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              الرمز يتجدد تلقائياً — الصفحة تحدّث نفسها كل ٥ ثوانٍ.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            ⏳ البوابة تتصل بواتساب… سيظهر رمز QR هنا خلال لحظات.
          </p>
        )}
      </section>

      {/* التفضيلات */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          أنواع التنبيهات
        </h2>
        {prefs === null ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <div className="mt-4 space-y-4">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  type="checkbox"
                  checked={prefs[t.key]}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [t.key]: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {t.label}
                  </span>
                  <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t.hint}
                  </span>
                </span>
              </label>
            ))}

            <label className="block pt-2">
              <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                رقم استقبال التنبيهات (اختياري)
              </span>
              <input
                value={prefs.whatsappPhone ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    whatsappPhone: e.target.value.trim() || null,
                  })
                }
                dir="ltr"
                inputMode="numeric"
                placeholder="9665xxxxxxxx"
                className="field w-full max-w-xs"
              />
              <span className="mt-1 block text-xs leading-5 text-zinc-400 dark:text-zinc-500">
                اتركه فارغاً لتصل الرسائل إلى محادثة «أنا» في الواتساب
                المرتبط نفسه. الرقم بصيغة دولية بلا +.
              </span>
            </label>

            <button
              type="button"
              onClick={savePrefs}
              disabled={saving}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ التفضيلات"}
            </button>
          </div>
        )}
      </section>

      {/* الأوامر التفاعلية */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          اسأل المنصة من واتساب
        </h2>
        <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          بعد الربط، أرسل إلى محادثة «أنا» (رسالة لنفسك) في واتساب:
        </p>
        <ul className="mt-3 space-y-2">
          {COMMANDS.map((c) => (
            <li key={c.cmd} className="flex items-baseline gap-3 text-sm">
              <code
                dir="ltr"
                className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-zinc-800 dark:text-brand-400"
              >
                {c.cmd}
              </code>
              <span className="text-zinc-600 dark:text-zinc-300">{c.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-6 text-zinc-400 dark:text-zinc-500">
        الربط عبر بوابة محلية تحاكي واتساب ويب (مكتبة Baileys) — طريقة غير
        رسمية مناسبة للاستخدام الشخصي. جلسة الربط تُحفظ على جهازك فقط.
        ⚠️ كل الرسائل فرز آلي — ليست توصية استثمارية، والفحص الشرعي تقديري.
      </p>
    </div>
  );
}
