"use client";

// استرجاع كلمة المرور بخطوتين: طلب رمز (بريد/واتساب) ثم إدخاله مع
// كلمة المرور الجديدة — نجاح الخطوة الثانية يسجّل الدخول مباشرة.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/useSession";

async function postJson(
  url: string,
  body: unknown
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    return res.ok
      ? { ok: true, detail: data.detail }
      : { ok: false, error: data.error ?? "خطأ غير متوقع." };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم." };
  }
}

export function ResetClient() {
  const session = useSession();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/forgot", { email });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "خطأ.");
      return;
    }
    setNotice(r.detail ?? "أُرسل الرمز إن كان البريد مسجلاً.");
    setStep(2);
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/reset", {
      email,
      code,
      newPassword: password,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "خطأ.");
      return;
    }
    session.refresh();
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          استرجاع كلمة المرور
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {step === 1
            ? "أدخل بريدك وسنرسل رمزاً من 6 أرقام إلى بريدك أو واتسابك المرتبط."
            : "أدخل الرمز الذي وصلك وكلمة المرور الجديدة."}
        </p>

        {notice && step === 2 ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}

        {step === 1 ? (
          <form onSubmit={requestCode} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                البريد الإلكتروني
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                dir="ltr"
                className="field w-full"
                autoComplete="email"
              />
            </label>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {busy ? "لحظة…" : "أرسل رمز الاسترجاع"}
            </button>
          </form>
        ) : (
          <form onSubmit={doReset} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                رمز الاسترجاع (6 أرقام)
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                required
                dir="ltr"
                className="field w-full text-center text-lg tracking-[0.5em]"
                autoComplete="one-time-code"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                كلمة المرور الجديدة (8 أحرف فأكثر)
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                dir="ltr"
                className="field w-full"
                autoComplete="new-password"
              />
            </label>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {busy ? "لحظة…" : "غيّر كلمة المرور وادخل"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="w-full text-center text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              لم يصلك الرمز؟ أعد الإرسال
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-zinc-400 dark:text-zinc-500">
          تذكرت كلمة المرور؟{" "}
          <Link href="/account" className="underline">
            سجّل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
