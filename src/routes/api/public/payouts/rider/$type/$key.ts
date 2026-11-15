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

// Safaricom posts the outcome of a rider wallet payout (B2C) here. Authenticated by
// the private callback key in the path, then matched to a payout by its M-Pesa references.
export const Route = createFileRoute("/api/public/payouts/rider/$type/$key")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { callbackKey, darajaConfig, tokensMatch } = await import("@/lib/mpesa.server");
        const config = darajaConfig();
        const key = params.key ?? "";
        if (!config || !key || !(await tokensMatch(await callbackKey(config.callbackToken), key))) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (params.type !== "result" && params.type !== "timeout") {
          return Response.json({ error: "Unknown callback" }, { status: 404 });
        }
        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid callback" }, { status: 400 });
        const result = parsed.data.Result;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let payout: { id: string; status: string } | null = null;
        for (const [column, value] of [
          ["provider_conversation_id", result.ConversationID],
          ["provider_originator_conversation_id", result.OriginatorConversationID],
        ] as const) {
          if (payout || !value) continue;
          const { data, error } = await supabaseAdmin
            .from("rider_payout_requests")
            .select("id,status")
            .eq(column, value)
            .maybeSingle();
          if (error) return Response.json({ error: "Lookup failed" }, { status: 503 });
          payout = data;
        }
        if (!payout) return Response.json({ error: "Unknown payout" }, { status: 404 });
        if (payout.status === "Paid" || payout.status === "Failed") return accepted();

        const now = new Date().toISOString();
        const code = Number(result.ResultCode);
        let update: Record<string, string | null>;
        if (params.type === "timeout") {
          update = { status: "Review", failure_reason: "Safaricom timed out; check the M-Pesa statement" };
        } else if (code === 0 && result.TransactionID) {
          update = {
            status: "Paid",
            provider_transaction_id: result.TransactionID,
            failure_reason: null,
            processed_at: now,
          };
        } else if (code === 0) {
          update = { status: "Review", failure_reason: "Safaricom reported success without a transaction code" };
        } else {
          update = {
            status: "Failed",
            failure_reason: (result.ResultDesc ?? "Safaricom rejected the payout").slice(0, 240),
            processed_at: now,
          };
        }
        const { error } = await supabaseAdmin
          .from("rider_payout_requests")
          .update({ ...update, updated_at: now })
          .eq("id", payout.id)
          .in("status", ["Processing", "Review"]);
        if (error) return Response.json({ error: "Could not record result" }, { status: 503 });
        return accepted();
      },
    },
  },
});
