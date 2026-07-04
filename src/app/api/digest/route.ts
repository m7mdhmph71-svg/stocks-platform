import { NextRequest, NextResponse } from "next/server";
import { ScreenerResponse } from "@/lib/types";
import { buildDailyDigest } from "@/lib/whatsapp/format";
import { sendWhatsApp, whatsappProvider } from "@/lib/whatsapp/send";

export const dynamic = "force-dynamic";
/** يجري فرزين حيين ثم يرسل — نافذة زمنية واسعة */
export const maxDuration = 300;

// الملخص اليومي: يجمع إشارات فلتري الزخم والسيولة، يبني رسالة عربية
// بخطة كل صفقة (هدف/وقف) وتعليمات التنفيذ، ويرسلها على واتساب.
//
// يُستدعى من جدولة Vercel Cron يومياً (تُرسل Authorization: Bearer CRON_SECRET
// تلقائياً عند ضبط المتغير)، أو يدوياً بـ ?secret=CRON_SECRET.
// أضف ?dry=1 لمعاينة الرسالة دون إرسال.

async function fetchScreener(
  origin: string,
  preset: string
): Promise<ScreenerResponse | null> {
  try {
    const res = await fetch(`${origin}/api/screener?preset=${preset}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ScreenerResponse;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const qsSecret = request.nextUrl.searchParams.get("secret") ?? "";
  const authorized =
    secret.length > 0 &&
    (auth === `Bearer ${secret}` || qsSecret === secret);

  if (!authorized) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }

  const dry = request.nextUrl.searchParams.get("dry") === "1";

  // لا مزوّد واتساب مضبوطاً والطلب ليس معاينة → تخطٍّ هادئ بلا عمل ولا أخطاء
  // (المنصة تعمل مستقلة بالكامل؛ الإرسال الآلي ميزة اختيارية خاملة)
  if (!dry && whatsappProvider() === null) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      detail: "لم يُفعَّل الإرسال الآلي — المنصة تعمل كاملة بدونه.",
    });
  }

  const origin = request.nextUrl.origin;

  const [momentum, liquidity] = await Promise.all([
    fetchScreener(origin, "momentum"),
    fetchScreener(origin, "liquidity"),
  ]);

  const message = buildDailyDigest({ momentum, liquidity }, new Date());

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      provider: whatsappProvider(),
      message,
    });
  }

  const result = await sendWhatsApp(message);
  if (!result.ok) {
    console.error("digest send failed:", result.detail);
  }
  return NextResponse.json(
    {
      ok: result.ok,
      provider: result.provider,
      detail: result.detail,
      signals:
        (momentum?.total ?? 0) + (liquidity?.total ?? 0),
      message,
    },
    { status: result.ok ? 200 : 502 }
  );
}
