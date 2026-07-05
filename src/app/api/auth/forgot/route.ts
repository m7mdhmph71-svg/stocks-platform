import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { hashToken, newResetCode } from "@/lib/auth/tokens";
import { mailEnabled, sendMail } from "@/lib/mail";
import { gatewayEnabled, gatewaySend } from "@/lib/gateway";

export const dynamic = "force-dynamic";

// طلب استرجاع كلمة المرور: رمز 6 أرقام صالح 15 دقيقة يُسلَّم عبر البريد
// (إن ضُبط Resend) و/أو واتساب (رقم المستخدم المحفوظ — أو محادثة «أنا»
// في نشرة المالك الواحد). الاستجابة واحدة دائماً — لا نكشف وجود البريد.

const CODE_TTL_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "أدخل بريدك الإلكتروني." }, { status: 400 });
  }

  const ip = clientIp(request.headers);
  if (
    !rateLimit(`forgot:mail:${email}`, 3, 60 * 60_000) ||
    !rateLimit(`forgot:ip:${ip}`, 6, 60 * 60_000)
  ) {
    return NextResponse.json(
      { error: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة." },
      { status: 429 }
    );
  }

  // الاستجابة الموحدة (تُبنى قبل معرفة النتيجة — نفس النص دائماً)
  const generic = NextResponse.json({
    ok: true,
    detail:
      "إن كان البريد مسجلاً لدينا فسيصلك رمز الاسترجاع عبر البريد أو واتساب خلال دقيقة.",
  });

  const user = await db().user.findUnique({
    where: { email },
    include: { notifyPref: true },
  });
  if (!user) return generic;

  // رمز جديد يلغي ما قبله
  const code = newResetCode();
  await db().authToken.deleteMany({ where: { userId: user.id, kind: "RESET" } });
  await db().authToken.create({
    data: {
      userId: user.id,
      kind: "RESET",
      tokenHash: hashToken(user.id, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const text =
    `🔐 رمز استرجاع كلمة المرور في سهم سكرينر: ${code}\n` +
    `صالح لمدة 15 دقيقة. إن لم تطلب الاسترجاع فتجاهل هذه الرسالة.`;

  let delivered = false;
  if (mailEnabled()) {
    const r = await sendMail(email, "رمز استرجاع كلمة المرور — سهم سكرينر", text);
    delivered = delivered || r.ok;
  }
  if (gatewayEnabled()) {
    // رقم المستخدم المحفوظ، وإلا محادثة «أنا» عندما يكون الحساب الوحيد
    // (نشرة المالك الواحد — حساب البوابة هو حساب المالك نفسه)
    let to: string | null = user.notifyPref?.whatsappPhone ?? null;
    if (!to) {
      const count = await db().user.count();
      if (count === 1) to = "self";
    }
    if (to) {
      const r = await gatewaySend(to, text);
      delivered = delivered || r.ok;
    }
  }
  if (!delivered) {
    console.error(`forgot-password: no delivery channel for user ${user.id}`);
  }
  return generic;
}
