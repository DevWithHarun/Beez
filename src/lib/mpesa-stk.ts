// Pure M-Pesa "enter your PIN" (STK push) rules shared by the server, the callback and tests.

export type StkStatus = 'requested' | 'paid' | 'failed' | 'cancelled' | 'timeout';

/** After this long without an answer, a prompt is treated as expired on the shopper's phone. */
export const STK_EXPIRY_MS = 3 * 60_000;
/** Ask Safaricom directly once a prompt is this old, in case its callback never reaches us. */
export const STK_QUERY_AFTER_MS = 20_000;
/** A new prompt for the same order can be sent after this long. */
export const STK_RESEND_AFTER_MS = 30_000;
/** At most this many prompts per order in ten minutes. */
export const STK_MAX_ATTEMPTS = 5;

/** YYYYMMDDHHmmss in Nairobi time (UTC+3, no daylight saving), as Daraja expects. */
export function darajaTimestamp(at: Date): string {
  const eat = new Date(at.getTime() + 3 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`;
}

/** Daraja password: base64(shortcode + passkey + timestamp). */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/** 2547XXXXXXXX / 2541XXXXXXXX from any Kenyan mobile form, or null. */
export function toMsisdn(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[17]\d{8}$/.test(digits) ? `254${digits}` : null;
}

/** "0712 *** 678" for showing which phone got the prompt. */
export function maskPhone(msisdn: string): string {
  const local = `0${msisdn.replace(/^254/, '')}`;
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
}

/** Final status for a Safaricom result code. */
export function stkStatusFor(resultCode: number): Exclude<StkStatus, 'requested'> {
  if (resultCode === 0) return 'paid';
  if (resultCode === 1032) return 'cancelled';
  if (resultCode === 1037) return 'timeout';
  return 'failed';
}

/** What to tell the shopper, in plain words, for a result code. */
export function stkMessage(status: StkStatus, resultCode: number | null): string {
  if (status === 'paid') return 'Payment received.';
  if (status === 'requested') return 'Check your phone and enter your M-Pesa PIN.';
  if (status === 'cancelled') return 'You cancelled the M-Pesa prompt.';
  if (status === 'timeout') return "The M-Pesa prompt expired before it was answered.";
  switch (resultCode) {
    case 1: return 'Not enough money in M-Pesa for this payment.';
    case 2001: return 'The M-Pesa PIN was wrong.';
    case 1025: case 9999: return "M-Pesa couldn't send the prompt to that phone.";
    case 1019: return 'The payment took too long and expired.';
    case 1001: return 'Another M-Pesa payment is in progress on that phone. Finish it, then try again.';
    default: return "M-Pesa didn't complete the payment.";
  }
}

export type StkCallback = {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  receipt: string | null;
  amount: number | null;
};

/** Reads Safaricom's STK callback body; null if it isn't one. */
export function parseStkCallback(body: unknown): StkCallback | null {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } } | null)?.Body?.stkCallback;
  if (!cb || typeof cb['CheckoutRequestID'] !== 'string') return null;
  const code = Number(cb['ResultCode']);
  if (!Number.isInteger(code)) return null;
  const items = ((cb['CallbackMetadata'] as { Item?: { Name?: string; Value?: unknown }[] } | undefined)?.Item) ?? [];
  const item = (name: string) => items.find(i => i.Name === name)?.Value;
  const receipt = item('MpesaReceiptNumber');
  const amount = Number(item('Amount'));
  return {
    checkoutRequestId: cb['CheckoutRequestID'].slice(0, 100),
    resultCode: code,
    resultDesc: String(cb['ResultDesc'] ?? '').slice(0, 300),
    receipt: typeof receipt === 'string' && /^[A-Z0-9]{6,20}$/.test(receipt) ? receipt : null,
    amount: Number.isFinite(amount) ? amount : null,
  };
}

/** Daraja query answer → final result, or null while the shopper hasn't answered yet. */
export function stkQueryResult(body: { ResultCode?: unknown; ResultDesc?: unknown; errorCode?: unknown } | null): { resultCode: number; resultDesc: string } | null {
  if (!body || body.errorCode) return null; // e.g. 500.001.1001 "still being processed"
  const code = Number(body.ResultCode);
  if (body.ResultCode === undefined || !Number.isInteger(code)) return null;
  return { resultCode: code, resultDesc: String(body.ResultDesc ?? '').slice(0, 300) };
}
