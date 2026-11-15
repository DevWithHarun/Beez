// Pure rules for the two-step QR handover (shop pickup, customer drop-off).
// The server signs HMAC_SHA256(orderId|kind|nonce) with a secret; the QR carries
// a shortened signature and the 4-digit backup code is derived from the same
// signature, so both prove the same thing. Tested.

export type HandoverKind = "pickup" | "dropoff";
export const MAX_FAILED_ATTEMPTS = 5;
const PREFIX = "BEEZ1";

export function handoverPayload(orderId: string, kind: HandoverKind, nonce: string) {
  return `${orderId}|${kind}|${nonce}`;
}

/** QR token: BEEZ1.<orderId>.<kind>.<first 16 hex of the signature>. */
export function buildHandoverToken(orderId: string, kind: HandoverKind, signatureHex: string) {
  return `${PREFIX}.${orderId}.${kind}.${signatureHex.slice(0, 16)}`;
}

export function parseHandoverToken(raw: string): { orderId: string; kind: HandoverKind; sig: string } | null {
  const parts = raw.trim().split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const [, orderId, kind, sig] = parts as [string, string, string, string];
  if (!orderId || orderId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(orderId)) return null;
  if (kind !== "pickup" && kind !== "dropoff") return null;
  if (!/^[0-9a-f]{16}$/.test(sig)) return null;
  return { orderId, kind, sig };
}

/** 4-digit backup code from the first 32 bits of the signature. */
export function shortCodeFromSignature(signatureHex: string) {
  const n = parseInt(signatureHex.slice(0, 8), 16);
  return String(n % 10_000).padStart(4, "0");
}

export function normalizeShortCode(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits.length === 4 ? digits : null;
}

/** Which handover the rider must complete next for an order status, if any. */
export function expectedHandoverKind(status: string): HandoverKind | null {
  if (status === "Assigned") return "pickup";
  if (status === "In Transit" || status === "Out for Delivery") return "dropoff";
  return null;
}

/** Whether the shop (pickup) or the customer (drop-off) may show their code now. */
export function canShowHandover(kind: HandoverKind, status: string) {
  return kind === "pickup" ? status === "Assigned" : status === "In Transit" || status === "Out for Delivery";
}

/** Constant-time string compare (equal lengths only). */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Did the rider's scan or typed code match the signature? */
export function handoverMatches(
  input: { token?: string | null; code?: string | null },
  expected: { orderId: string; kind: HandoverKind; signatureHex: string },
) {
  if (input.token) {
    const t = parseHandoverToken(input.token);
    if (!t || t.orderId !== expected.orderId || t.kind !== expected.kind) return false;
    return safeEqual(t.sig, expected.signatureHex.slice(0, 16));
  }
  const code = input.code ? normalizeShortCode(input.code) : null;
  return !!code && safeEqual(code, shortCodeFromSignature(expected.signatureHex));
}
