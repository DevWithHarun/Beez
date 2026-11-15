// Server-only SMS sending through BlessedTexts, with the optional fallback
// provider used by the sign-in code sender.

export function smsConfigured(): boolean {
  return Boolean(process.env["SMS_API_KEY"]?.trim() && process.env["SMS_SENDER_ID"]?.trim());
}

export type SmsResult = { ok: true; messageId: string | null } | { ok: false; error: string };

async function sendPrimary(phone: string, message: string): Promise<SmsResult> {
  const url =
    process.env["SMS_PRIMARY_API_URL"]?.trim() || "https://sms.blessedtexts.com/api/sms/v1/sendsms";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env["SMS_API_KEY"]!.trim(),
      sender_id: process.env["SMS_SENDER_ID"]!.trim(),
      phone,
      message,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as
    | { status_code?: string; status_desc?: string; message_id?: string }
    | Array<{ status_code?: string; status_desc?: string; message_id?: string }>
    | null;
  const item = Array.isArray(body) ? body[0] : body;
  if (response.ok && item?.status_code === "1000") return { ok: true, messageId: item.message_id ?? null };
  return { ok: false, error: `Primary SMS provider: ${item?.status_desc ?? `HTTP ${response.status}`}` };
}

async function sendFallback(phone: string, message: string): Promise<SmsResult> {
  const url = process.env["SMS_FALLBACK_API_URL"]?.trim();
  if (!url) return { ok: false, error: "No fallback SMS provider configured" };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: process.env["SMS_API_KEY"]!.trim(),
      shortCode: process.env["SMS_SENDER_ID"]!.trim(),
      recipient: phone,
      message,
      callbackURL: process.env["SMS_CALLBACK_URL"]?.trim() ?? "",
      enqueue: 0,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok ? { ok: true, messageId: null } : { ok: false, error: `Fallback SMS provider: HTTP ${response.status}` };
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  if (!smsConfigured()) return { ok: false, error: "SMS is not set up" };
  let primary: SmsResult;
  try {
    primary = await sendPrimary(phone, message);
  } catch (e) {
    primary = { ok: false, error: e instanceof Error ? e.message : "Primary SMS provider failed" };
  }
  if (primary.ok) return primary;
  try {
    const fallback = await sendFallback(phone, message);
    return fallback.ok ? fallback : { ok: false, error: `${primary.error}; ${fallback.error}` };
  } catch (e) {
    return { ok: false, error: `${primary.error}; ${e instanceof Error ? e.message : "fallback failed"}` };
  }
}
