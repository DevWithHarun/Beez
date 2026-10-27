import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type SendSmsEvent = {
  user?: { phone?: unknown };
  sms?: { otp?: unknown };
};

type BlessedTextsResponse = {
  status_code?: string;
  status_desc?: string;
  message_id?: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required function secret: ${name}`);
  return value;
}

function hookResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("The phone number is not a valid Kenyan mobile number");
}

async function sendWithBlessedTexts(phone: string, message: string): Promise<void> {
  const apiUrl =
    Deno.env.get("SMS_PRIMARY_API_URL")?.trim() ||
    Deno.env.get("SMS_API_URL")?.trim() ||
    "https://sms.blessedtexts.com/api/sms/v1/sendsms";
  const apiKey = requiredEnv("SMS_API_KEY");
  const senderId = requiredEnv("SMS_SENDER_ID");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      sender_id: senderId,
      phone,
      message,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  let result: BlessedTextsResponse | BlessedTextsResponse[] | null = null;
  try {
    result = await response.json();
  } catch {
    throw new Error(`BlessedTexts returned a non-JSON response (HTTP ${response.status})`);
  }

  const item = Array.isArray(result) ? result[0] : result;
  if (!response.ok || item?.status_code !== "1000") {
    const description =
      typeof item?.status_desc === "string" ? item.status_desc : `HTTP ${response.status}`;
    throw new Error(`BlessedTexts rejected the SMS: ${description}`);
  }
}

async function sendWithFallback(phone: string, message: string): Promise<void> {
  const fallbackUrl = Deno.env.get("SMS_FALLBACK_API_URL")?.trim();
  if (!fallbackUrl) throw new Error("SMS_FALLBACK_API_URL is not configured");

  const response = await fetch(fallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: requiredEnv("SMS_API_KEY"),
      shortCode: requiredEnv("SMS_SENDER_ID"),
      recipient: phone,
      message,
      callbackURL: Deno.env.get("SMS_CALLBACK_URL")?.trim() ?? "",
      enqueue: 0,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Fallback SMS provider rejected the SMS (HTTP ${response.status})`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return hookResponse(405, {
      error: { http_code: 405, message: "Method not allowed" },
    });
  }

  try {
    const payload = await request.text();
    const hookSecrets = requiredEnv("SEND_SMS_HOOK_SECRETS");
    const webhook = new Webhook(hookSecrets.replace(/^v1,whsec_/, ""));
    const event = webhook.verify(payload, Object.fromEntries(request.headers)) as SendSmsEvent;

    const rawPhone = event.user?.phone;
    const otp = event.sms?.otp;
    if (typeof rawPhone !== "string" || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return hookResponse(400, {
        error: { http_code: 400, message: "Invalid Send SMS hook payload" },
      });
    }

    const phone = formatKenyanPhone(rawPhone);
    const message = `Beez verification code: ${otp}. Do not share this code.`;
    try {
      await sendWithBlessedTexts(phone, message);
    } catch (primaryError) {
      console.warn(
        `[send-sms-hook] BlessedTexts send failed; trying fallback: ${
          primaryError instanceof Error ? primaryError.message : "unknown provider error"
        }`,
      );
      await sendWithFallback(phone, message);
    }
    return hookResponse(200, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected SMS hook failure";
    console.error(`[send-sms-hook] ${message}`);
    return hookResponse(502, {
      error: { http_code: 502, message: "SMS delivery failed" },
    });
  }
});
