import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/session";
import { db, dbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// وسيط بوابة واتساب — يتيح ربط الحساب من داخل المنصة نفسها:
// المتصفح يكلّم هذا المسار (بجلسة دخول)، وهو يكلّم البوابة المحلية
// (GATEWAY_URL) مضيفاً السر المشترك. بلا GATEWAY_URL الميزة تختفي بسلاسة.

function gatewayUrl(): string | null {
  const u = process.env.GATEWAY_URL;
  return u && u.length > 0 ? u.replace(/\/$/, "") : null;
}

async function gatewayFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = gatewayUrl();
  if (!base) throw new Error("no gateway");
  return fetch(base + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-gateway-secret": process.env.CRON_SECRET ?? "",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(path === "/api/digest-now" ? 290_000 : 10_000),
  });
}

export interface GatewayStatusResponse {
  /** هل ميزة البوابة مضبوطة على هذا النشر؟ */
  enabled: boolean;
  /** هل البوابة تعمل ويمكن الوصول إليها؟ */
  reachable: boolean;
  connected: boolean;
  /** صورة رمز QR (data URL) عند انتظار الربط */
  qr: string | null;
  /** حساب واتساب المرتبط */
  selfJid: string | null;
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  if (!gatewayUrl()) {
    const res: GatewayStatusResponse = {
      enabled: false,
      reachable: false,
      connected: false,
      qr: null,
      selfJid: null,
    };
    return NextResponse.json(res);
  }

  try {
    const r = await gatewayFetch("/api/status");
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as {
      connected?: boolean;
      qr?: string | null;
      selfJid?: string | null;
    };
    const res: GatewayStatusResponse = {
      enabled: true,
      reachable: true,
      connected: !!data.connected,
      qr: data.qr ?? null,
      selfJid: data.selfJid ?? null,
    };
    return NextResponse.json(res);
  } catch {
    const res: GatewayStatusResponse = {
      enabled: true,
      reachable: false,
      connected: false,
      qr: null,
      selfJid: null,
    };
    return NextResponse.json(res);
  }
}

export async function POST(request: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  if (!gatewayUrl()) {
    return NextResponse.json(
      { error: "بوابة واتساب غير مضبوطة على هذا النشر." },
      { status: 503 }
    );
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "test": {
        // رسالة تجريبية إلى وجهة المستخدم (رقمه المحفوظ أو «أنا»)
        let to = "self";
        if (dbEnabled()) {
          const pref = await db().notifyPref.findUnique({ where: { userId } });
          if (pref?.whatsappPhone) to = pref.whatsappPhone;
        }
        const r = await gatewayFetch("/api/send", {
          method: "POST",
          body: JSON.stringify({
            to,
            text: "✅ تنبيهات سهم سكرينر تعمل — هذه رسالة تجريبية من صفحة «تنبيهاتي».",
          }),
        });
        const data = await r.json().catch(() => ({}));
        return NextResponse.json(data, { status: r.ok ? 200 : 502 });
      }
      case "digest": {
        const r = await gatewayFetch("/api/digest-now", { method: "POST" });
        const data = await r.json().catch(() => ({}));
        return NextResponse.json(data, { status: r.ok ? 200 : 502 });
      }
      case "logout": {
        const r = await gatewayFetch("/api/logout", { method: "POST" });
        const data = await r.json().catch(() => ({}));
        return NextResponse.json(data, { status: r.ok ? 200 : 502 });
      }
      default:
        return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "تعذّر الوصول إلى البوابة — تأكد أنها تعمل." },
      { status: 502 }
    );
  }
}
