import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { INIT_SQL } from "@/lib/dbInit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// تهيئة قاعدة البيانات لمرة واحدة (للنشرات بلا خدمة ترحيل مثل Vercel):
// يُنشئ الجداول من مخطط Prisma إن لم تكن موجودة. محمي بـ CRON_SECRET.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const qs = request.nextUrl.searchParams.get("secret") ?? "";
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL غير مضبوط." },
      { status: 503 }
    );
  }

  try {
    // إن كان جدول المستخدمين موجوداً فالمخطط مُهيأ سلفاً
    const existing = await db().$queryRawUnsafe<Array<{ t: string | null }>>(
      `SELECT to_regclass('public."User"')::text AS t`
    );
    if (existing[0]?.t) {
      return NextResponse.json({ ok: true, already: true });
    }

    // طبّق عبارات الإنشاء واحدة تلو الأخرى (مع تجريد أسطر التعليقات
    // من داخل كل عبارة — كل مقطع يبدأ بسطر تعليق من مولّد Prisma)
    const statements = INIT_SQL.split(/;\s*\n/)
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim()
      )
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db().$executeRawUnsafe(stmt);
    }
    return NextResponse.json({ ok: true, applied: statements.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("db-init failed:", msg);
    return NextResponse.json(
      { error: "فشلت التهيئة: " + msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
