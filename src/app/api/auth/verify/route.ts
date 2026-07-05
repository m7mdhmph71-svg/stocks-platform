import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { hashToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/auth/sendVerification";
import { mailEnabled } from "@/lib/mail";

export const dynamic = "force-dynamic";

// توثيق البريد:
//   GET  ?token=…  ← رابط الرسالة، يوثّق ثم يحوّل لصفحة الحساب
//   POST           ← (بجلسة دخول) إرسال/إعادة إرسال رابط التوثيق

export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  if (!dbEnabled()) return to("/account");

  const raw = request.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(raw)) return to("/account?verified=0");

  const ip = clientIp(request.headers);
  if (!rateLimit(`verify:${ip}`, 10, 15 * 60_000)) return to("/account?verified=0");

  // الهاش مرتبط بمعرف المستخدم — نبحث بكل المستخدمين أصحاب رموز توثيق حية
  const candidates = await db().authToken.findMany({
    where: { kind: "VERIFY", usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, tokenHash: true },
    take: 500,
  });
  const hit = candidates.find((t) => t.tokenHash === hashToken(t.userId, raw));
  if (!hit) return to("/account?verified=0");

  await db().authToken.update({
    where: { id: hit.id },
    data: { usedAt: new Date() },
  });
  await db().user.update({
    where: { id: hit.userId },
    data: { emailVerified: new Date() },
  });
  return to("/account?verified=1");
}

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  if (!mailEnabled()) {
    return NextResponse.json(
      { error: "إرسال البريد غير مضبوط على هذا النشر." },
      { status: 503 }
    );
  }
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  if (!rateLimit(`sendverify:${userId}`, 3, 60 * 60_000)) {
    return NextResponse.json(
      { error: "أُرسل الرابط مؤخراً — تفقد بريدك (والمزعج) أو انتظر ساعة." },
      { status: 429 }
    );
  }

  const user = await db().user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "الحساب غير موجود." }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, already: true });
  }

  const r = await sendVerificationEmail(
    userId,
    user.email,
    user.name,
    request.nextUrl.origin
  );
  if (!r.ok) {
    console.error("send-verify failed:", r.detail);
    return NextResponse.json(
      { error: "تعذّر إرسال البريد — حاول لاحقاً." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
