import { NextRequest, NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// تفضيلات تنبيهات واتساب للمستخدم الحالي — قراءة وحفظ.

async function requireUser(): Promise<string | NextResponse> {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  return userId;
}

export interface NotifyPrefsPayload {
  whatsappPhone: string | null;
  alertWatchlist: boolean;
  alertTrades: boolean;
  alertShariah: boolean;
  weeklyReport: boolean;
}

const DEFAULTS: NotifyPrefsPayload = {
  whatsappPhone: null,
  alertWatchlist: true,
  alertTrades: true,
  alertShariah: true,
  weeklyReport: true,
};

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const pref = await db().notifyPref.findUnique({ where: { userId: auth } });
  const payload: NotifyPrefsPayload = pref
    ? {
        whatsappPhone: pref.whatsappPhone,
        alertWatchlist: pref.alertWatchlist,
        alertTrades: pref.alertTrades,
        alertShariah: pref.alertShariah,
        weeklyReport: pref.weeklyReport,
      }
    : DEFAULTS;
  return NextResponse.json(payload);
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: Partial<NotifyPrefsPayload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  let phone: string | null = null;
  if (typeof body.whatsappPhone === "string" && body.whatsappPhone.trim()) {
    const digits = body.whatsappPhone.replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(digits)) {
      return NextResponse.json(
        { error: "الرقم بصيغة دولية بلا + (مثال: 9665xxxxxxxx)." },
        { status: 400 }
      );
    }
    phone = digits;
  }

  const data = {
    whatsappPhone: phone,
    alertWatchlist: body.alertWatchlist !== false,
    alertTrades: body.alertTrades !== false,
    alertShariah: body.alertShariah !== false,
    weeklyReport: body.weeklyReport !== false,
  };

  await db().notifyPref.upsert({
    where: { userId: auth },
    create: { userId: auth, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
