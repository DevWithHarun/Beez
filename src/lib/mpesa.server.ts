// Server-only Safaricom Daraja B2C helpers for customer refunds and rider payouts.
import { publicAppUrl } from "./app-url.server";

type DarajaConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  callbackToken: string;
};

const NAMES = [
  "DARAJA_CONSUMER_KEY",
  "DARAJA_CONSUMER_SECRET",
  "DARAJA_SHORTCODE",
  "DARAJA_INITIATOR_NAME",
  "DARAJA_SECURITY_CREDENTIAL",
  "DARAJA_CALLBACK_TOKEN",
] as const;

export function darajaConfig(): DarajaConfig | null {
  const v = Object.fromEntries(NAMES.map((n) => [n, process.env[n]?.trim() ?? ""])) as Record<
    (typeof NAMES)[number],
    string
  >;
  if (NAMES.some((n) => !v[n])) return null;
  const env = process.env["DARAJA_ENVIRONMENT"]?.trim() || "sandbox";
  return {
    baseUrl: env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: v.DARAJA_CONSUMER_KEY,
    consumerSecret: v.DARAJA_CONSUMER_SECRET,
    shortcode: v.DARAJA_SHORTCODE,
    initiatorName: v.DARAJA_INITIATOR_NAME,
    securityCredential: v.DARAJA_SECURITY_CREDENTIAL,
    callbackToken: v.DARAJA_CALLBACK_TOKEN,
  };
}

export async function tokensMatch(expected: string, received: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
    crypto.subtle.digest("SHA-256", enc.encode(received)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** URL-safe key standing in for the callback token in provider callback paths. */
export async function callbackKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`beez-callback:${token}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type B2cSubmit =
  | { kind: "submitted"; conversationId: string | null; originatorId: string | null }
  | { kind: "rejected"; reason: string }
  | { kind: "unknown"; reason: string };

/** Sends a B2C payment. "unknown" means Safaricom may or may not have taken it. */
export async function submitB2c(
  config: DarajaConfig,
  p: { amountKes: number; phone: string; remarks: string; occasion: string; callbackPath: string },
): Promise<B2cSubmit> {
  const auth = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${config.consumerKey}:${config.consumerSecret}`)}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const authBody = (await auth?.json().catch(() => null)) as { access_token?: string } | null;
  if (!auth?.ok || !authBody?.access_token) return { kind: "rejected", reason: "Safaricom sign-in failed" };

  // Safaricom rejects callback addresses containing words like "mpesa", so the paths stay neutral.
  const key = await callbackKey(config.callbackToken);
  const callback = (type: "result" | "timeout") => `${publicAppUrl()}${p.callbackPath}/${type}/${key}`;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authBody.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        InitiatorName: config.initiatorName,
        SecurityCredential: config.securityCredential,
        CommandID: "BusinessPayment",
        Amount: p.amountKes,
        PartyA: config.shortcode,
        PartyB: p.phone,
        Remarks: p.remarks.slice(0, 100),
        QueueTimeOutURL: callback("timeout"),
        ResultURL: callback("result"),
        Occasion: p.occasion,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { kind: "unknown", reason: "No answer from Safaricom; check the M-Pesa statement before retrying" };
  }
  const body = (await response.json().catch(() => null)) as {
    ResponseCode?: string | number;
    ResponseDescription?: string;
    errorMessage?: string;
    ConversationID?: string;
    OriginatorConversationID?: string;
  } | null;
  if (response.ok && String(body?.ResponseCode ?? "") === "0") {
    return {
      kind: "submitted",
      conversationId: body?.ConversationID ?? null,
      originatorId: body?.OriginatorConversationID ?? null,
    };
  }
  if (response.status >= 500 || !body) {
    return { kind: "unknown", reason: "Safaricom gave an unclear answer; check the M-Pesa statement before retrying" };
  }
  return {
    kind: "rejected",
    reason: (body.errorMessage || body.ResponseDescription || `Safaricom refused (HTTP ${response.status})`).slice(0, 240),
  };
}

/** Sends a customer refund. */
export function submitRefundB2c(
  config: DarajaConfig,
  refund: { id: string; order_id: string; amount_kes: number; phone: string },
): Promise<B2cSubmit> {
  return submitB2c(config, {
    amountKes: refund.amount_kes,
    phone: refund.phone,
    remarks: `Beez refund ${refund.order_id}`,
    occasion: refund.id,
    callbackPath: "/api/public/payouts/refund",
  });
}

/** Sends a rider wallet payout. */
export function submitRiderPayoutB2c(
  config: DarajaConfig,
  payout: { id: string; amount_kes: number; destination_phone: string },
): Promise<B2cSubmit> {
  return submitB2c(config, {
    amountKes: payout.amount_kes,
    phone: payout.destination_phone,
    remarks: `Beez rider payout ${payout.id}`,
    occasion: payout.id,
    callbackPath: "/api/public/payouts/rider",
  });
}
