import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, dbEnabled } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { hashToken } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

// تنفيذ الاسترجاع: البريد + الرمز + كلمة المرور الجديدة.
// الرمز محدود المحاولات (5) والصلاحية (15 دقيقة) والاستخدام (مرة واحدة).

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }

  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  const newPassword = body.newPassword ?? "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "الرمز 6 أرقام." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "كلمة المرور الجديدة 8 أحرف على الأقل." },
      { status: 400 }
    );
  }

  const ip = clientIp(request.headers);
  if (!rateLimit(`reset:${ip}:${email}`, 10, 15 * 60_000)) {
    return NextResponse.json(
      { error: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة." },
      { status: 429 }
    );
  }

  const fail = () =>
    NextResponse.json(
      { error: "الرمز غير صحيح أو انتهت صلاحيته — اطلب رمزاً جديداً." },
      { status: 400 }
    );

  const user = await db().user.findUnique({ where: { email } });
  if (!user) return fail();

  const token = await db().authToken.findFirst({
    where: {
      userId: user.id,
      kind: "RESET",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.attempts >= MAX_ATTEMPTS) return fail();

  if (token.tokenHash !== hashToken(user.id, code)) {
    await db().authToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return fail();
  }

  await db().authToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
  await db().user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  // دخول مباشر بعد الاسترجاع
  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, plan: user.plan },
  });
}
