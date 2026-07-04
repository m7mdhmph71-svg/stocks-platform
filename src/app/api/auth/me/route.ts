import { NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** حالة الحسابات والجلسة الحالية — تستهلكه الواجهة لإظهار/إخفاء الميزات */
export async function GET() {
  if (!dbEnabled()) {
    return NextResponse.json({ enabled: false, user: null });
  }
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ enabled: true, user: null });
  }
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true, createdAt: true },
  });
  return NextResponse.json({ enabled: true, user });
}
