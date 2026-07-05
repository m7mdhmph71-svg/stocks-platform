// رموز الاستخدام الواحد — توليد وهاش (لا يُخزَّن رمز خام أبداً).

import { createHash, randomBytes, randomInt } from "node:crypto";

/** رمز استرجاع قصير يُدخله المستخدم يدوياً (6 أرقام) */
export function newResetCode(): string {
  return String(randomInt(100000, 1000000));
}

/** رمز رابط طويل (توثيق البريد) */
export function newLinkToken(): string {
  return randomBytes(32).toString("hex");
}

/** هاش الرمز مع معرف المستخدم — يمنع نقل رمز مستخدم لآخر */
export function hashToken(userId: string, token: string): string {
  return createHash("sha256").update(`${userId}:${token}`).digest("hex");
}
