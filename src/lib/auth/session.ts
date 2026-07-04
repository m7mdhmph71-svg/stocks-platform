// جلسات المستخدمين: JWT موقّع في كوكي httpOnly — بلا مخازن جلسات إضافية.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "sahm_session";
const MAX_AGE_S = 30 * 24 * 60 * 60; // ٣٠ يوماً

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    // لا نسمح بسر ضعيف في الإنتاج؛ في التطوير نستخدم ثابتاً معلناً
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET غير مضبوط (١٦ حرفاً على الأقل).");
    }
    return new TextEncoder().encode("dev-only-secret-not-for-production");
  }
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + MAX_AGE_S)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    // COOKIE_SECURE=0 للتجربة المحلية عبر http (سفاري يرفض كوكي Secure
    // على localhost بلا تشفير، بخلاف كروم) — الافتراضي في الإنتاج: آمن
    secure:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === "1"
        : process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

/** معرف المستخدم من كوكي الجلسة أو null */
export async function sessionUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
