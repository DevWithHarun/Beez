import { createFileRoute } from "@tanstack/react-router";

const accepted = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

// Safaricom posts the shopper's answer to an M-Pesa PIN prompt here. Authenticated by
// the private callback key in the path, then matched to a prompt we sent by its CheckoutRequestID.
export const Route = createFileRoute("/api/public/payments/confirm/$key")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { stkConfig } = await import("@/lib/mpesa-stk.server");
        const { callbackKey, tokensMatch } = await import("@/lib/mpesa.server");
        const config = stkConfig();
        const key = params.key ?? "";
        if (!config || !key || !(await tokensMatch(await callbackKey(config.callbackToken), key))) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const raw = await request.text();
        if (raw.length > 20_000) return Response.json({ error: "Too large" }, { status: 413 });
        const { parseStkCallback } = await import("@/lib/mpesa-stk");
        let body: unknown = null;
        try { body = JSON.parse(raw); } catch { /* handled below */ }
        const cb = parseStkCallback(body);
        if (!cb) return Response.json({ error: "Invalid callback" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment, error: lookupError } = await supabaseAdmin
          .from("mpesa_payments")
          .select("amount_kes")
          .eq("checkout_request_id", cb.checkoutRequestId)
          .maybeSingle();
        if (lookupError) return Response.json({ error: "Lookup failed" }, { status: 503 });
        if (!payment) return Response.json({ error: "Unknown payment" }, { status: 404 });
        // A success must carry the exact amount we asked for.
        const amountOk = cb.resultCode !== 0 || cb.amount === null || cb.amount === payment.amount_kes;
        const { error } = await supabaseAdmin.rpc("service_record_mpesa_result", {
          _checkout_request_id: cb.checkoutRequestId,
          _result_code: amountOk ? cb.resultCode : 1,
          _result_desc: amountOk ? cb.resultDesc : `Amount mismatch: ${cb.amount}`,
          ...(cb.receipt ? { _receipt: cb.receipt } : {}),
        });
        if (error) return Response.json({ error: "Could not record result" }, { status: 503 });
        return accepted();
      },
    },
  },
});
