// Server-only Safaricom Daraja STK push ("enter your M-Pesa PIN") calls.
import { publicAppUrl } from './app-url.server';
import { darajaTimestamp, stkPassword } from './mpesa-stk';
import { callbackKey } from './mpesa.server';

export type StkConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  partyB: string;
  transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  callbackToken: string;
};

const env = (name: string) => process.env[name]?.trim() ?? '';

/** STK settings, or null when M-Pesa prompts aren't set up yet. */
export function stkConfig(): StkConfig | null {
  const consumerKey = env('DARAJA_CONSUMER_KEY');
  const consumerSecret = env('DARAJA_CONSUMER_SECRET');
  const shortcode = env('DARAJA_STK_SHORTCODE') || env('DARAJA_SHORTCODE');
  const passkey = env('DARAJA_PASSKEY');
  const callbackToken = env('DARAJA_CALLBACK_TOKEN');
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackToken) return null;
  const till = env('DARAJA_TILL_NUMBER');
  return {
    baseUrl: env('DARAJA_ENVIRONMENT') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
    consumerKey, consumerSecret, shortcode, passkey, callbackToken,
    partyB: till || shortcode,
    transactionType: till ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
  };
}

async function accessToken(config: StkConfig): Promise<string | null> {
  const res = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${config.consumerKey}:${config.consumerSecret}`)}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { access_token?: string } | null;
  return res?.ok && body?.access_token ? body.access_token : null;
}

export type StkPushResult =
  | { ok: true; checkoutRequestId: string; merchantRequestId: string | null }
  | { ok: false; reason: string };

export async function sendStkPush(config: StkConfig, p: { orderId: string; amountKes: number; msisdn: string }): Promise<StkPushResult> {
  const token = await accessToken(config);
  if (!token) return { ok: false, reason: "M-Pesa isn't answering right now. Please try again in a minute." };
  const timestamp = darajaTimestamp(new Date());
  // Safaricom rejects callback addresses containing words like "mpesa", so the path stays neutral.
  const callback = `${publicAppUrl()}/api/public/payments/confirm/${await callbackKey(config.callbackToken)}`;
  const res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: stkPassword(config.shortcode, config.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: p.amountKes,
      PartyA: p.msisdn,
      PartyB: config.partyB,
      PhoneNumber: p.msisdn,
      CallBackURL: callback,
      AccountReference: p.orderId.slice(0, 12),
      TransactionDesc: 'Beez order',
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as {
    ResponseCode?: string; CheckoutRequestID?: string; MerchantRequestID?: string; errorMessage?: string;
  } | null;
  if (res?.ok && String(body?.ResponseCode) === '0' && body?.CheckoutRequestID) {
    return { ok: true, checkoutRequestId: body.CheckoutRequestID, merchantRequestId: body.MerchantRequestID ?? null };
  }
  console.error('M-Pesa STK push refused', res?.status, body?.errorMessage);
  const detail = body?.errorMessage ?? '';
  if (/phone|party ?a|msisdn/i.test(detail)) return { ok: false, reason: "M-Pesa couldn't send the prompt to that number. Check it and try again." };
  return { ok: false, reason: "M-Pesa couldn't send the prompt right now. Please try again, or pay cash instead." };
}

/** Raw Daraja answer for a prompt's current state, or null if Safaricom didn't answer. */
export async function queryStk(config: StkConfig, checkoutRequestId: string): Promise<Record<string, unknown> | null> {
  const token = await accessToken(config);
  if (!token) return null;
  const timestamp = darajaTimestamp(new Date());
  const res = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: stkPassword(config.shortcode, config.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return (await res?.json().catch(() => null)) as Record<string, unknown> | null;
}
