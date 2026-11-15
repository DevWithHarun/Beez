// Server-only: sends queued customer text messages (order declined/expired,
// refund sent). Rows are claimed atomically, so overlapping runs never double-send.
import { buildCustomerSms, type CustomerMessageDetails, type CustomerMessageKind } from "./customer-messages";
import { sendSms, smsConfigured } from "./sms.server";

export async function dispatchCustomerNotifications(limit = 20): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!smsConfigured()) return { sent: 0, failed: 0, skipped: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("claim_customer_notifications", { _limit: limit });
  if (error) {
    console.error("claim_customer_notifications failed", error.message);
    return { sent: 0, failed: 0, skipped: false };
  }
  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    if (!row.phone) continue;
    const message = buildCustomerSms(
      row.kind as CustomerMessageKind,
      row.order_id,
      (row.details ?? {}) as CustomerMessageDetails,
    );
    const result = await sendSms(row.phone, message);
    const { error: finishError } = await supabaseAdmin.rpc("finish_customer_notification", {
      _id: row.id,
      _ok: result.ok,
      ...(result.ok ? (result.messageId ? { _provider_message_id: result.messageId } : {}) : { _error: result.error }),
    });
    if (finishError) console.error("finish_customer_notification failed", finishError.message);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, skipped: false };
}

/** Never let a messaging problem break the caller's main action. */
export async function dispatchQuietly(): Promise<void> {
  try {
    await dispatchCustomerNotifications(10);
  } catch (e) {
    console.error("Customer message dispatch failed", e instanceof Error ? e.message : e);
  }
}
