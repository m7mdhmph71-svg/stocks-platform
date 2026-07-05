"use client";

// صفحة الحساب: تسجيل/دخول/ملف المستخدم — تعمل فقط عندما تكون الحسابات مفعّلة

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/useSession";

async function postJson(
  url: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "خطأ غير متوقع." };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم." };
  }
}

export function AccountClient() {
  const session = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r =
      mode === "login"
        ? await postJson("/api/auth/login", { email, password })
        : await postJson("/api/auth/register", { email, password, name });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "خطأ.");
      return;
    }
    session.refresh();
    router.refresh();
  }

  async function logout() {
    await postJson("/api/auth/logout", {});
    session.refresh();
    router.refresh();
  }

  if (session.loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
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
            هذه النسخة التجريبية تعمل بلا قاعدة بيانات. ميزات الحسابات (قائمة
            المتابعة وسجل الصفقات) تتفعل تلقائياً عند النشر على الخادم الخاص
            بقاعدة بيانات — راجع دليل النشر في المستودع.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-block px-6 py-2">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  if (session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            حسابي
          </h1>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">الاسم</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                {session.user.name ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">البريد</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-50" dir="ltr">
                {session.user.email}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">الخطة</dt>
              <dd>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-bold " +
                    (session.user.plan === "PRO"
                      ? "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
                  }
                >
                  {session.user.plan === "PRO" ? "احترافية" : "مجانية"}
                </span>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/watchlist" className="btn-primary px-5 py-2 text-sm">
              قائمة المتابعة
            </Link>
            <Link href="/trades" className="btn-ghost px-5 py-2 text-sm">
              سجل صفقاتي
            </Link>
            <Link href="/whatsapp" className="btn-ghost px-5 py-2 text-sm">
              تنبيهات واتساب
            </Link>
            <button
              type="button"
              onClick={logout}
              className="ms-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex gap-2">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={
                "flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors " +
                (mode === m
                  ? "bg-brand-600 text-white"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300")
              }
            >
              {m === "login" ? "تسجيل الدخول" : "حساب جديد"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" ? (
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                الاسم (اختياري)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field w-full"
                autoComplete="name"
              />
            </label>
          ) : null}
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
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
              كلمة المرور {mode === "register" ? "(8 أحرف فأكثر)" : ""}
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              dir="ltr"
              className="field w-full"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
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
            {busy ? "لحظة…" : mode === "login" ? "دخول" : "إنشاء الحساب"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
          بإنشائك الحساب توافق على{" "}
          <Link href="/terms" className="underline">
            شروط الاستخدام
          </Link>
          {" "}— المنصة أداة فرز وتحليل وليست جهة توصيات مالية.
        </p>
      </div>
    </div>
  );
}
