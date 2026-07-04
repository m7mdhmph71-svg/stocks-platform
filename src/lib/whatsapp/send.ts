// إرسال رسائل واتساب — مزوّدان:
//
// 1) CallMeBot (الأسهل — مجاني للاستخدام الشخصي):
//    أرسل «I allow callmebot to send me messages» إلى رقم البوت من واتساب
//    (الرقم الحالي في callmebot.com/blog/free-api-whatsapp-messages)
//    فيصلك apikey. ثم اضبط:
//      CALLMEBOT_PHONE=9665xxxxxxxx  (رقمك بصيغة دولية بلا +)
//      CALLMEBOT_APIKEY=123456
//
// 2) WhatsApp Cloud API (الرسمي من Meta — للمتقدمين):
//      WHATSAPP_TOKEN=EAA...        (توكن دائم من تطبيق Meta Business)
//      WHATSAPP_PHONE_ID=1234567890 (معرّف رقم الإرسال)
//      WHATSAPP_TO=9665xxxxxxxx     (المستلم بصيغة دولية بلا +)
//    تنبيه: الرسائل النصية الحرة تصل فقط داخل نافذة 24 ساعة من آخر رسالة
//    من المستلم — للتنبيهات اليومية الشخصية CallMeBot أنسب.

export type WhatsAppProvider = "callmebot" | "cloudapi";

export interface SendResult {
  ok: boolean;
  provider: WhatsAppProvider | null;
  detail: string;
}

export function whatsappProvider(): WhatsAppProvider | null {
  if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
    return "callmebot";
  }
  if (
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID &&
    process.env.WHATSAPP_TO
  ) {
    return "cloudapi";
  }
  return null;
}

async function sendCallMeBot(text: string): Promise<SendResult> {
  const phone = process.env.CALLMEBOT_PHONE ?? "";
  const apikey = process.env.CALLMEBOT_APIKEY ?? "";
  const url =
    "https://api.callmebot.com/whatsapp.php?phone=" +
    encodeURIComponent(phone) +
    "&apikey=" +
    encodeURIComponent(apikey) +
    "&text=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const body = (await res.text()).slice(0, 200);
  const ok = res.ok && !/error/i.test(body);
  return {
    ok,
    provider: "callmebot",
    detail: ok ? "sent" : `callmebot ${res.status}: ${body}`,
  };
}

async function sendCloudApi(text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN ?? "";
  const phoneId = process.env.WHATSAPP_PHONE_ID ?? "";
  const to = process.env.WHATSAPP_TO ?? "";
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    }
  );
  const body = (await res.text()).slice(0, 300);
  return {
    ok: res.ok,
    provider: "cloudapi",
    detail: res.ok ? "sent" : `cloudapi ${res.status}: ${body}`,
  };
}

/** يرسل عبر المزوّد المضبوط في متغيرات البيئة */
export async function sendWhatsApp(text: string): Promise<SendResult> {
  const provider = whatsappProvider();
  if (provider === "callmebot") return sendCallMeBot(text);
  if (provider === "cloudapi") return sendCloudApi(text);
  return {
    ok: false,
    provider: null,
    detail:
      "لم يُضبط أي مزوّد واتساب — راجع CALLMEBOT_* أو WHATSAPP_* في متغيرات البيئة.",
  };
}
