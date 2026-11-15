import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const friendly = (message: string | undefined, fallback: string) =>
  message && !/permission|violates|syntax|relation|function/i.test(message) ? message : fallback;

/** Can rider wallet payouts be sent by M-Pesa right now? (No secrets returned.) */
export const getRiderPayoutSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { darajaConfig } = await import("./mpesa.server");
    return { available: darajaConfig() !== null };
  });

/**
 * Rider withdraws wallet earnings to their M-Pesa number. The database checks
 * the rider, their phone and available earnings; the server then sends the B2C payment.
 */
export const requestRiderPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      amountKes: z.number().int().min(1).max(250_000),
      idempotencyKey: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { darajaConfig, submitRiderPayoutB2c } = await import("./mpesa.server");
    const config = darajaConfig();
    if (!config) throw new Error("M-Pesa payouts aren't switched on yet. Please contact Beez support.");

    const { data: payoutId, error } = await context.supabase.rpc("rider_request_mpesa_payout", {
      _amount_kes: data.amountKes,
      _idempotency_key: data.idempotencyKey,
    });
    if (error || !payoutId) throw new Error(friendly(error?.message, "Your payout request could not be created."));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = () => new Date().toISOString();
    // Claim it once, so a repeated tap never sends the same payout twice.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("rider_payout_requests")
      .update({ status: "Processing", failure_reason: null, updated_at: now() })
      .eq("id", payoutId)
      .eq("rider_id", context.userId)
      .eq("status", "Requested")
      .select("id, amount_kes, destination_phone")
      .maybeSingle();
    if (claimError) throw new Error("Your payout was recorded but couldn't be sent. Please contact support.");
    if (!claimed) {
      const { data: existing } = await supabaseAdmin
        .from("rider_payout_requests")
        .select("status")
        .eq("id", payoutId)
        .eq("rider_id", context.userId)
        .maybeSingle();
      return { status: (existing?.status ?? "Processing") as string };
    }

    const submit = await submitRiderPayoutB2c(config, claimed);
    if (submit.kind === "submitted") {
      await supabaseAdmin
        .from("rider_payout_requests")
        .update({
          provider_conversation_id: submit.conversationId,
          provider_originator_conversation_id: submit.originatorId,
          updated_at: now(),
        })
        .eq("id", claimed.id)
        .eq("status", "Processing");
      return { status: "Processing" };
    }
    if (submit.kind === "rejected") {
      await supabaseAdmin
        .from("rider_payout_requests")
        .update({ status: "Failed", failure_reason: submit.reason, processed_at: now(), updated_at: now() })
        .eq("id", claimed.id)
        .eq("status", "Processing");
      throw new Error("Safaricom didn't accept the payout. Nothing was sent; please try again later.");
    }
    await supabaseAdmin
      .from("rider_payout_requests")
      .update({ status: "Review", failure_reason: submit.reason, updated_at: now() })
      .eq("id", claimed.id)
      .eq("status", "Processing");
    return { status: "Review" };
  });
