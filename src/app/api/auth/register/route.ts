import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, dbEnabled } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/auth/sendVerification";
import { mailEnabled } from "@/lib/mail";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  // حد إنشاء الحسابات لكل عنوان — يصد التسجيل الآلي
  if (!rateLimit(`register:${clientIp(request.headers)}`, 5, 60 * 60_000)) {
    return NextResponse.json(
      { error: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة." },
      { status: 429 }
    );
  }
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim().slice(0, 80) || null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "بريد إلكتروني غير صالح." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "كلمة المرور 8 أحرف على الأقل." },
      { status: 400 }
    );
  }

  const existing = await db().user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "هذا البريد مسجّل مسبقاً — سجّل الدخول." },
      { status: 409 }
    );
  }

  const user = await db().user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), name },
  });
  await createSession(user.id);

  // رابط توثيق البريد (عند ضبط الإرسال) — فشله لا يعطل التسجيل
  if (mailEnabled()) {
    sendVerificationEmail(user.id, user.email, user.name, request.nextUrl.origin).catch(
      (e) => console.error("register verify mail failed:", e)
    );
  }

  return NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, plan: user.plan },
  });
}
