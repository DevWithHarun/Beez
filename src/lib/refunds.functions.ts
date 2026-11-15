import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMpesaReference } from "./customer-messages";

const idSchema = z.object({ refundId: z.string().uuid() });

const friendly = (message: string | undefined, fallback: string) =>
  message && !/permission|violates|syntax|relation/i.test(message) ? message : fallback;

/** Is M-Pesa refund sending set up on the server? (No secrets returned.) */
export const getRefundSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { darajaConfig } = await import("./mpesa.server");
    const { smsConfigured } = await import("./sms.server");
    return { mpesa: darajaConfig() !== null, sms: smsConfigured() };
  });

/** Admin approves a refund and Beez sends it by M-Pesa (B2C). */
export const sendRefundByMpesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { darajaConfig, submitRefundB2c } = await import("./mpesa.server");
    const config = darajaConfig();
    if (!config) {
      throw new Error("M-Pesa refunds aren't set up yet. Send it from your M-Pesa account and record the code instead.");
    }
    // Admin check and the pending -> processing lock happen inside the database.
    const { data: begun, error } = await context.supabase.rpc("admin_begin_refund_payout", {
      _refund_id: data.refundId,
    });
    if (error || !begun) throw new Error(friendly(error?.message, "This refund could not be started."));
    const refund = z
      .object({ id: z.string(), order_id: z.string(), amount_kes: z.number(), phone: z.string() })
      .parse(begun);

    const submit = await submitRefundB2c(config, refund);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (submit.kind === "submitted") {
      await supabaseAdmin.rpc("service_update_refund_payout", {
        _refund_id: refund.id,
        _outcome: "submitted",
        ...(submit.conversationId ? { _conversation_id: submit.conversationId } : {}),
        ...(submit.originatorId ? { _originator_id: submit.originatorId } : {}),
      });
      return { status: "processing" as const };
    }
    await supabaseAdmin.rpc("service_update_refund_payout", {
      _refund_id: refund.id,
      _outcome: submit.kind === "rejected" ? "failed" : "review",
      _reason: submit.reason,
    });
    throw new Error(submit.reason);
  });

/** Admin records a refund already sent outside Beez (M-Pesa business account). */
export const recordManualRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema.extend({ reference: z.string().trim().min(1).max(20) }))
  .handler(async ({ data, context }) => {
    const reference = normalizeMpesaReference(data.reference);
    if (!reference) throw new Error("Enter the M-Pesa transaction code (8-12 letters and numbers).");
    const { error } = await context.supabase.rpc("admin_record_manual_refund", {
      _refund_id: data.refundId,
      _reference: reference,
    });
    if (error) throw new Error(friendly(error.message, "The refund could not be recorded."));
    const { dispatchQuietly } = await import("./followups.server");
    await dispatchQuietly();
    return { status: "refunded" as const };
  });

/** Admin closes a refund because no payment was actually received. */
export const rejectRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema.extend({ note: z.string().trim().min(3).max(300) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_reject_refund", {
      _refund_id: data.refundId,
      _note: data.note,
    });
    if (error) throw new Error(friendly(error.message, "The refund could not be updated."));
    return { status: "rejected" as const };
  });
