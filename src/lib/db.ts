// عميل قاعدة البيانات — يعمل فقط عند ضبط DATABASE_URL.
// بدونها تعمل المنصة بوضع «بلا حسابات» بسلاسة (نشر Vercel التجريبي مثلاً).

import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export function dbEnabled(): boolean {
  return typeof process.env.DATABASE_URL === "string" &&
    process.env.DATABASE_URL.length > 0;
}

export function db(): PrismaClient {
  if (!dbEnabled()) {
    throw new Error("DATABASE_URL غير مضبوط — الحسابات غير مفعّلة على هذا النشر.");
  }
  if (!g.__prisma) {
    g.__prisma = new PrismaClient();
  }
  return g.__prisma;
}
