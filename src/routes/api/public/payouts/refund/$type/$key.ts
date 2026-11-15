import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  Result: z.object({
    ResultCode: z.union([z.number(), z.string()]).optional(),
    ResultDesc: z.string().max(1000).optional(),
    ConversationID: z.string().max(200).optional(),
    OriginatorConversationID: z.string().max(200).optional(),
    TransactionID: z.string().max(60).optional(),
  }),
});

const accepted = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

// Safaricom posts the outcome of a customer refund (B2C) here. Authenticated by
// the private callback key in the path, then matched to a refund by its M-Pesa references.
export const Route = createFileRoute("/api/public/payouts/refund/$type/$key")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { callbackKey, darajaConfig, tokensMatch } = await import("@/lib/mpesa.server");
        const config = darajaConfig();
        const key = params.key ?? "";
        if (!config || !key || !(await tokensMatch(await callbackKey(config.callbackToken), key))) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid callback" }, { status: 400 });
        const result = parsed.data.Result;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let refund: { id: string; status: string } | null = null;
        for (const [column, value] of [
          ["provider_conversation_id", result.ConversationID],
          ["provider_originator_conversation_id", result.OriginatorConversationID],
        ] as const) {
          if (refund || !value) continue;
          const { data, error } = await supabaseAdmin
            .from("order_refunds")
            .select("id,status")
            .eq(column, value)
            .maybeSingle();
          if (error) return Response.json({ error: "Lookup failed" }, { status: 503 });
          refund = data;
        }
        if (!refund) return Response.json({ error: "Unknown refund" }, { status: 404 });
        if (["refunded", "rejected", "failed"].includes(refund.status)) return accepted();

        const type = params.type;
        const code = Number(result.ResultCode);
        let outcome: "success" | "failed" | "review";
        let reason: string | undefined;
        if (type === "timeout") {
          outcome = "review";
          reason = "Safaricom timed out; check the M-Pesa statement";
        } else if (code === 0 && result.TransactionID) {
          outcome = "success";
        } else if (code === 0) {
          outcome = "review";
          reason = "Safaricom reported success without a transaction code";
        } else {
          outcome = "failed";
          reason = (result.ResultDesc ?? "Safaricom rejected the refund").slice(0, 240);
        }

        const { error } = await supabaseAdmin.rpc("service_update_refund_payout", {
          _refund_id: refund.id,
          _outcome: outcome,
          ...(result.TransactionID ? { _reference: result.TransactionID } : {}),
          ...(reason ? { _reason: reason } : {}),
        });
        if (error) return Response.json({ error: "Could not record result" }, { status: 503 });
        if (outcome === "success") {
          const { dispatchQuietly } = await import("@/lib/followups.server");
          await dispatchQuietly();
        }
        return accepted();
      },
    },
  },
});
