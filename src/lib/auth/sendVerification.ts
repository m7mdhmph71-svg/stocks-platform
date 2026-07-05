// إنشاء رمز توثيق البريد وإرسال رابطه — تستعمله مسارات التسجيل
// وإعادة الإرسال. يفترض أن mailEnabled() تحقق مسبقاً.

import { db } from "@/lib/db";
import { hashToken, newLinkToken } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/mail";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string | null,
  origin: string
): Promise<{ ok: boolean; detail: string }> {
  const token = newLinkToken();
  await db().authToken.deleteMany({ where: { userId, kind: "VERIFY" } });
  await db().authToken.create({
    data: {
      userId,
      kind: "VERIFY",
      tokenHash: hashToken(userId, token),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });

  const base = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || origin;
  const link = `${base}/api/auth/verify?token=${token}`;
  return sendMail(
    email,
    "وثّق بريدك — سهم سكرينر",
    `أهلاً${name ? ` ${name}` : ""}،\n\nلتوثيق بريدك في سهم سكرينر افتح الرابط التالي (صالح 24 ساعة):\n${link}\n\nإن لم تنشئ الحساب فتجاهل هذه الرسالة.`
  );
}
