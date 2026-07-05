// مرسل رسائل عبر بوابة واتساب المحلية (خادم → بوابة) — قناة بديلة
// لتسليم رموز الاسترجاع عند غياب البريد. اختياري: بلا GATEWAY_URL يتعطل بأمان.

export function gatewayEnabled(): boolean {
  return (
    typeof process.env.GATEWAY_URL === "string" &&
    process.env.GATEWAY_URL.length > 0
  );
}

export interface GatewaySendResult {
  ok: boolean;
  detail: string;
}

/** يرسل نصاً عبر البوابة: to = "self" أو رقم دولي بلا + */
export async function gatewaySend(
  to: string,
  text: string
): Promise<GatewaySendResult> {
  if (!gatewayEnabled()) return { ok: false, detail: "gateway not configured" };
  try {
    const base = (process.env.GATEWAY_URL as string).replace(/\/$/, "");
    const res = await fetch(`${base}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": process.env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({ to, text }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, detail: `gateway ${res.status}` };
    return { ok: true, detail: "sent" };
  } catch (e) {
    return { ok: false, detail: String(e instanceof Error ? e.message : e) };
  }
}
