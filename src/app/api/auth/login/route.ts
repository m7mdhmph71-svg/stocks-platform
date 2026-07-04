import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, dbEnabled } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = await db().user.findUnique({ where: { email } });

  // رسالة واحدة للحالتين — لا نكشف وجود البريد من عدمه
  const fail = () =>
    NextResponse.json(
      { error: "بيانات الدخول غير صحيحة." },
      { status: 401 }
    );

  if (!user) return fail();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail();

  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, plan: user.plan },
  });
}
