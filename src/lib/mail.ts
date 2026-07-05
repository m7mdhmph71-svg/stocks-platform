// إرسال البريد عبر واجهة Resend المباشرة (fetch — بلا تبعيات جديدة).
// اختياري بالكامل: بلا RESEND_API_KEY تتدهور ميزات البريد بأمان
// (استرجاع كلمة المرور يسقط لقناة واتساب إن توفرت).

export function mailEnabled(): boolean {
  return (
    typeof process.env.RESEND_API_KEY === "string" &&
    process.env.RESEND_API_KEY.length > 0 &&
    typeof process.env.MAIL_FROM === "string" &&
    process.env.MAIL_FROM.length > 0
  );
}

export interface MailResult {
  ok: boolean;
  detail: string;
}

export async function sendMail(
  to: string,
  subject: string,
  text: string
): Promise<MailResult> {
  if (!mailEnabled()) {
    return { ok: false, detail: "mail not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, detail: `resend ${res.status}: ${body}` };
    }
    return { ok: true, detail: "sent" };
  } catch (e) {
    return { ok: false, detail: String(e instanceof Error ? e.message : e) };
  }
}
