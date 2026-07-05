import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

// تفعيل/إلغاء الاشتراك يدوياً (قبل بوابة الدفع) — محمي بـ CRON_SECRET:
//   GET /api/admin/set-plan?secret=…&email=…&plan=PRO&days=365
//   plan=FREE يعيد الحساب للمجانية. days اختياري (بلا انتهاء إن غاب).

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const qs = request.nextUrl.searchParams.get("secret") ?? "";
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }
  if (!dbEnabled()) {
    return NextResponse.json({ error: "DATABASE_URL غير مضبوط." }, { status: 503 });
  }

  const email = (request.nextUrl.searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();
  const plan = (request.nextUrl.searchParams.get("plan") ?? "").toUpperCase();
  const daysRaw = request.nextUrl.searchParams.get("days");

  if (!email || (plan !== "PRO" && plan !== "FREE")) {
    return NextResponse.json(
      { error: "المطلوب: email و plan=PRO|FREE (وdays اختياري)." },
      { status: 400 }
    );
  }

  const user = await db().user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "لا حساب بهذا البريد." }, { status: 404 });
  }

  let planExpires: Date | null = null;
  if (plan === "PRO" && daysRaw) {
    const days = Number(daysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      return NextResponse.json({ error: "days رقم موجب." }, { status: 400 });
    }
    planExpires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const updated = await db().user.update({
    where: { id: user.id },
    data: { plan: plan as "PRO" | "FREE", planExpires },
    select: { email: true, plan: true, planExpires: true },
  });
  return NextResponse.json({ ok: true, user: updated });
}
