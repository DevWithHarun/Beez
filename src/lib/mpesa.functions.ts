import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import {
  STK_EXPIRY_MS, STK_MAX_ATTEMPTS, STK_QUERY_AFTER_MS, STK_RESEND_AFTER_MS,
  maskPhone, stkMessage, stkQueryResult, toMsisdn, type StkStatus,
} from '@/lib/mpesa-stk';

export type MpesaPaymentView = {
  available: boolean;
  orderPaymentStatus: string;
  orderPaymentMethod: string;
  orderStatus: string;
  amountKes: number;
  defaultPhone: string;
  attempt: null | {
    status: StkStatus;
    phone: string;
    receipt: string | null;
    message: string;
    sentAt: string;
    canResend: boolean;
  };
};

const orderInput = z.object({ orderId: z.string().trim().regex(/^[A-Z0-9-]{3,40}$/) });

/** Whether real M-Pesa prompts are switched on. */
export const mpesaAvailable = createServerFn({ method: 'GET' }).handler(async () => {
  const { stkConfig } = await import('@/lib/mpesa-stk.server');
  return { available: stkConfig() !== null };
});

async function loadOrder(supabase: SupabaseClient<Database>, orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, total_kes, payment_status, payment_method, status, customer_phone, customer_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error('Your order could not be loaded. Please try again.');
  if (!data) throw new Error('Order not found.');
  return data;
}

/** Sends the "enter your M-Pesa PIN" prompt for one of the shopper's own unpaid orders. */
export const startMpesaPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput.extend({ phone: z.string().trim().max(20).optional() }))
  .handler(async ({ data, context }) => {
    const order = await loadOrder(context.supabase, data.orderId);
    if (order.customer_id !== context.userId) throw new Error('Order not found.');
    if (order.payment_status !== 'Unpaid') throw new Error('This order is already paid.');
    if (order.status === 'Cancelled' || order.status === 'Delivered') throw new Error('This order is closed, so it can no longer be paid.');
    if (order.total_kes <= 0) throw new Error('There is nothing to pay on this order.');
    const msisdn = toMsisdn(data.phone || order.customer_phone);
    if (!msisdn) throw new Error('Use a Kenyan M-Pesa number, like 0712 345 678.');

    const { stkConfig, sendStkPush } = await import('@/lib/mpesa-stk.server');
    const config = stkConfig();
    if (!config) throw new Error("M-Pesa payments aren't switched on yet. You can pay cash instead.");

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent, error: recentError } = await supabaseAdmin
      .from('mpesa_payments')
      .select('status, created_at')
      .eq('order_id', order.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (recentError) throw new Error('M-Pesa could not be reached. Please try again.');
    if ((recent ?? []).length >= STK_MAX_ATTEMPTS) throw new Error('Too many M-Pesa prompts for this order. Wait a few minutes, or pay cash instead.');
    const last = recent?.[0];
    if (last?.status === 'requested' && Date.now() - Date.parse(last.created_at) < STK_RESEND_AFTER_MS) {
      throw new Error('A prompt was just sent. Check your phone.');
    }

    const push = await sendStkPush(config, { orderId: order.id, amountKes: order.total_kes, msisdn });
    if (!push.ok) throw new Error(push.reason);
    // Any older unanswered prompt for this order is replaced by the new one.
    await supabaseAdmin.from('mpesa_payments').update({ status: 'timeout', result_desc: 'Replaced by a new prompt' })
      .eq('order_id', order.id).eq('status', 'requested');
    const { error: insertError } = await supabaseAdmin.from('mpesa_payments').insert({
      order_id: order.id,
      customer_id: context.userId,
      phone: msisdn,
      amount_kes: order.total_kes,
      checkout_request_id: push.checkoutRequestId,
      merchant_request_id: push.merchantRequestId,
    });
    if (insertError) {
      console.error('Could not save M-Pesa prompt', insertError.message);
      throw new Error('The prompt was sent but could not be tracked. If you pay, it will still be matched to your order.');
    }
    return { sent: true, phone: maskPhone(msisdn) };
  });

/** Current payment state of one of the shopper's orders; asks Safaricom when a prompt has gone quiet. */
export const getMpesaPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }): Promise<MpesaPaymentView> => {
    const order = await loadOrder(context.supabase, data.orderId);
    const { stkConfig, queryStk } = await import('@/lib/mpesa-stk.server');
    const config = stkConfig();

    const readLatest = async () => {
      const { data: rows, error } = await context.supabase
        .from('mpesa_payments')
        .select('status, phone, receipt, result_code, checkout_request_id, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw new Error('Payment details could not be loaded.');
      return rows?.[0] ?? null;
    };

    let latest = await readLatest();
    let current = order;
    if (latest?.status === 'requested' && latest.checkout_request_id && config) {
      const age = Date.now() - Date.parse(latest.created_at);
      let result: { resultCode: number; resultDesc: string } | null = null;
      if (age >= STK_QUERY_AFTER_MS) result = stkQueryResult(await queryStk(config, latest.checkout_request_id));
      if (!result && age >= STK_EXPIRY_MS) result = { resultCode: 1037, resultDesc: 'No answer on the phone' };
      if (result) {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { error } = await supabaseAdmin.rpc('service_record_mpesa_result', {
          _checkout_request_id: latest.checkout_request_id,
          _result_code: result.resultCode,
          _result_desc: result.resultDesc,
        });
        if (!error) {
          latest = await readLatest();
          current = await loadOrder(context.supabase, data.orderId);
        }
      }
    }

    return {
      available: config !== null,
      orderPaymentStatus: current.payment_status,
      orderPaymentMethod: current.payment_method,
      orderStatus: current.status,
      amountKes: current.total_kes,
      defaultPhone: current.customer_phone.replace(/^\+?254/, '0'),
      attempt: latest ? {
        status: latest.status as StkStatus,
        phone: maskPhone(latest.phone),
        receipt: latest.receipt,
        message: stkMessage(latest.status as StkStatus, latest.result_code),
        sentAt: latest.created_at,
        canResend: latest.status !== 'requested' || Date.now() - Date.parse(latest.created_at) >= STK_RESEND_AFTER_MS,
      } : null,
    };
  });

/** Shopper switches an unpaid M-Pesa order to cash on delivery / at pickup. */
export const payCashInstead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('customer_pay_cash_instead', { _order_id: data.orderId });
    if (error) {
      if (error.message.includes('still waiting')) throw new Error('An M-Pesa prompt is still open on your phone. Cancel it or wait a moment, then try again.');
      if (error.message.includes('already paid')) throw new Error('This order is already paid or set to cash.');
      throw new Error("Couldn't switch to cash. Please try again.");
    }
    return { ok: true };
  });
