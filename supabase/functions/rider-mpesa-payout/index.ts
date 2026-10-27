import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callbackUrl,
  corsHeaders,
  getDarajaAccessToken,
  getDarajaConfig,
  getServiceRoleKey,
  getSupabaseAnonKey,
  jsonResponse,
} from "../_shared/mpesa.ts";

type PayoutRow = {
  id: string;
  rider_id: string;
  amount_kes: number;
  destination_phone: string;
  status: string;
  provider_conversation_id: string | null;
  provider_originator_conversation_id: string | null;
  provider_transaction_id: string | null;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL function secret");

    const authorization = request.headers.get("Authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: "Sign in to request a payout" }, 401);

    const body = await request.json().catch(() => null);
    const amount = body?.amount_kes;
    const idempotencyKey = body?.idempotency_key;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 250000) {
      return jsonResponse({ error: "Enter a whole-number amount from KES 1 to KES 250,000" }, 400);
    }
    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey,
      )
    ) {
      return jsonResponse({ error: "A valid payout request key is required" }, 400);
    }

    const publishableKey = getSupabaseAnonKey();
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !userResult.user)
      return jsonResponse({ error: "Your session is not valid" }, 401);

    const config = getDarajaConfig();
    const serviceClient = createClient(supabaseUrl, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: payoutId, error: createError } = await userClient.rpc(
      "rider_request_mpesa_payout",
      { _amount_kes: amount, _idempotency_key: idempotencyKey },
    );
    if (createError || !payoutId) {
      return jsonResponse(
        { error: createError?.message ?? "Payout request could not be created" },
        400,
      );
    }

    const { data: claimedPayout, error: claimError } = await serviceClient
      .from("rider_payout_requests")
      .update({ status: "Processing", failure_reason: null, updated_at: new Date().toISOString() })
      .eq("id", payoutId)
      .eq("rider_id", userResult.user.id)
      .eq("status", "Requested")
      .select("*")
      .maybeSingle();

    if (claimError) {
      console.error("Unable to claim M-Pesa payout request");
      return jsonResponse(
        { error: "Payout was recorded but could not be submitted. Contact support." },
        500,
      );
    }

    let payout = claimedPayout as PayoutRow | null;
    if (!payout) {
      const { data: existing, error: lookupError } = await serviceClient
        .from("rider_payout_requests")
        .select("*")
        .eq("id", payoutId)
        .eq("rider_id", userResult.user.id)
        .maybeSingle();
      if (lookupError || !existing) {
        return jsonResponse({ error: "Payout request status could not be loaded" }, 500);
      }
      return jsonResponse({ payout: existing, submitted: false }, 200);
    }

    try {
      const access = await getDarajaAccessToken(config);
      const response = await fetch(`${config.baseUrl}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          InitiatorName: config.initiatorName,
          SecurityCredential: config.securityCredential,
          CommandID: config.commandId,
          Amount: payout.amount_kes,
          PartyA: config.shortcode,
          PartyB: payout.destination_phone,
          Remarks: `Beez rider payout ${payout.id}`,
          QueueTimeOutURL: callbackUrl("timeout", config.callbackToken),
          ResultURL: callbackUrl("result", config.callbackToken),
          Occasion: payout.id,
        }),
      });
      const providerResult = await response.json().catch(() => null);
      const responseCode = String(providerResult?.ResponseCode ?? "");

      if (response.ok && responseCode === "0") {
        const { data: updated, error: updateError } = await serviceClient
          .from("rider_payout_requests")
          .update({
            provider_conversation_id: providerResult.ConversationID ?? null,
            provider_originator_conversation_id: providerResult.OriginatorConversationID ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id)
          .eq("status", "Processing")
          .select("*")
          .maybeSingle();
        if (updateError || !updated) {
          console.error("Safaricom accepted a payout but its reference could not be saved");
          return jsonResponse(
            {
              error:
                "Safaricom accepted the payout, but its reference could not be saved. Contact support before retrying.",
              payout_id: payout.id,
            },
            202,
          );
        }
        payout = updated as PayoutRow;
        return jsonResponse({ payout, submitted: true }, 202);
      }

      if (response.ok && responseCode && responseCode !== "0") {
        const { data: failed } = await serviceClient
          .from("rider_payout_requests")
          .update({
            status: "Failed",
            failure_reason: "Safaricom rejected the payout request",
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id)
          .eq("status", "Processing")
          .select("*")
          .maybeSingle();
        return jsonResponse(
          {
            payout: failed ?? { ...payout, status: "Review" },
            submitted: false,
            error: "Safaricom did not accept the payout request.",
          },
          502,
        );
      }

      throw new Error("Safaricom returned an ambiguous payout response");
    } catch (providerError) {
      console.error("M-Pesa payout submission needs reconciliation", providerError);
      const { data: review } = await serviceClient
        .from("rider_payout_requests")
        .update({
          status: "Review",
          failure_reason: "Provider response could not be confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout.id)
        .eq("status", "Processing")
        .select("*")
        .maybeSingle();
      return jsonResponse(
        {
          payout: review ?? { ...payout, status: "Review" },
          submitted: false,
          message: "Payout status needs confirmation. Do not submit it again; contact support.",
        },
        202,
      );
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Payout request failed";
    return jsonResponse({ error: message }, 503);
  }
});
