import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, dbEnabled } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
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
  return NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, plan: user.plan },
  });
}
