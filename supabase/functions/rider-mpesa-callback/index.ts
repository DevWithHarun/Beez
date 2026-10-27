import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDarajaConfig, getServiceRoleKey, jsonResponse } from "../_shared/mpesa.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");

async function safeTokenMatch(expected: string, received: string) {
  const encoder = new TextEncoder();
  const [expectedHash, receivedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
  ]);
  const a = new Uint8Array(expectedHash);
  const b = new Uint8Array(receivedHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const config = getDarajaConfig();
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL function secret");

    const url = new URL(request.url);
    const receivedToken = url.searchParams.get("token") ?? "";
    if (!receivedToken || !(await safeTokenMatch(config.callbackToken, receivedToken))) {
      return jsonResponse({ error: "Unauthorized callback" }, 401);
    }

    const payload = await request.json().catch(() => null);
    const result = payload?.Result;
    if (!result || typeof result !== "object") {
      return jsonResponse({ error: "Invalid provider callback" }, 400);
    }

    const serviceClient = createClient(supabaseUrl, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payout = null;
    if (typeof result.ConversationID === "string" && result.ConversationID) {
      const lookup = await serviceClient
        .from("rider_payout_requests")
        .select("*")
        .eq("provider_conversation_id", result.ConversationID)
        .maybeSingle();
      if (lookup.error) throw new Error("Payout callback lookup failed");
      payout = lookup.data;
    }
    if (
      !payout &&
      typeof result.OriginatorConversationID === "string" &&
      result.OriginatorConversationID
    ) {
      const lookup = await serviceClient
        .from("rider_payout_requests")
        .select("*")
        .eq("provider_originator_conversation_id", result.OriginatorConversationID)
        .maybeSingle();
      if (lookup.error) throw new Error("Payout callback lookup failed");
      payout = lookup.data;
    }
    if (!payout) {
      console.error("M-Pesa callback received for an unknown payout reference");
      return jsonResponse({ error: "Payout reference not found" }, 503);
    }

    if (payout.status === "Paid" || payout.status === "Failed") {
      return jsonResponse({ Result: "Accepted" });
    }

    const callbackType = url.searchParams.get("type");
    const now = new Date().toISOString();
    if (callbackType === "timeout") {
      const { error } = await serviceClient
        .from("rider_payout_requests")
        .update({
          status: "Review",
          failure_reason: "Safaricom did not confirm request processing before timeout",
          updated_at: now,
        })
        .eq("id", payout.id)
        .in("status", ["Processing", "Review"]);
      if (error) throw new Error("Payout timeout could not be recorded");
      return jsonResponse({ Result: "Accepted" });
    }

    const resultCode = Number(result.ResultCode);
    if (!Number.isInteger(resultCode)) {
      return jsonResponse({ error: "Provider callback is missing a valid result code" }, 400);
    }
    if (resultCode === 0) {
      if (typeof result.TransactionID !== "string" || !result.TransactionID) {
        const { error } = await serviceClient
          .from("rider_payout_requests")
          .update({
            status: "Review",
            failure_reason: "Provider reported success without a transaction reference",
            updated_at: now,
          })
          .eq("id", payout.id)
          .in("status", ["Processing", "Review"]);
        if (error) throw new Error("Payout review state could not be recorded");
        return jsonResponse({ Result: "Accepted" });
      }
      const { error } = await serviceClient
        .from("rider_payout_requests")
        .update({
          status: "Paid",
          provider_transaction_id: result.TransactionID,
          failure_reason: null,
          processed_at: now,
          updated_at: now,
        })
        .eq("id", payout.id)
        .in("status", ["Processing", "Review"]);
      if (error) throw new Error("Successful payout could not be recorded");
      return jsonResponse({ Result: "Accepted" });
    }

    const description =
      typeof result.ResultDesc === "string"
        ? result.ResultDesc.slice(0, 240)
        : "Provider rejected payout";
    const { error } = await serviceClient
      .from("rider_payout_requests")
      .update({
        status: "Failed",
        failure_reason: description,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", payout.id)
      .in("status", ["Processing", "Review"]);
    if (error) throw new Error("Failed payout could not be recorded");
    return jsonResponse({ Result: "Accepted" });
  } catch (caughtError) {
    console.error("Unable to process M-Pesa payout callback", caughtError);
    return jsonResponse({ error: "Payout callback could not be processed" }, 500);
  }
});
