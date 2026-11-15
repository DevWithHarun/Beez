// Issues and checks the pickup / drop-off handover codes. Only the shop owner can
// see the pickup code, only the shopper the drop-off code, and only the assigned
// rider can redeem them. Each code works once; 5 wrong tries lock it until the
// holder reopens it (which issues a fresh code).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_FAILED_ATTEMPTS,
  buildHandoverToken,
  canShowHandover,
  expectedHandoverKind,
  handoverMatches,
  handoverPayload,
  shortCodeFromSignature,
  type HandoverKind,
} from "@/lib/handover";

async function sign(payload: string) {
  const secret = process.env["HANDOVER_QR_SECRET"];
  if (!secret) throw new Error("Handover codes are not set up yet.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const orderIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const getHandoverCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: orderIdSchema, kind: z.enum(["pickup", "dropoff"]) }))
  .handler(async ({ data, context }) => {
    // RLS: the caller only sees orders they're the shopper, shop or rider for.
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, status, customer_id, merchant_id, rider_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (data.kind === "dropoff" && order.customer_id !== context.userId) throw new Error("Only the customer can show the delivery code.");
    if (data.kind === "pickup") {
      const { data: shop } = await context.supabase
        .from("merchants")
        .select("id")
        .eq("id", order.merchant_id ?? "")
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!shop) throw new Error("Only the shop can show the pickup code.");
    }
    if (!order.rider_id || !canShowHandover(data.kind, order.status)) {
      return { ready: false as const, status: order.status };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: row } = await supabaseAdmin
      .from("order_handover_codes")
      .select("nonce, failed_attempts, used_at")
      .eq("order_id", order.id)
      .eq("kind", data.kind)
      .maybeSingle();
    if (row?.used_at) return { ready: false as const, status: order.status };
    if (!row || row.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      const nonce = newNonce();
      const { error } = await supabaseAdmin
        .from("order_handover_codes")
        .upsert({ order_id: order.id, kind: data.kind, nonce, failed_attempts: 0 }, { onConflict: "order_id,kind" });
      if (error) {
        console.error("Handover code could not be saved", error);
        throw new Error("The code could not be created. Please try again.");
      }
      row = { nonce, failed_attempts: 0, used_at: null };
    }
    const sig = await sign(handoverPayload(order.id, data.kind, row.nonce));
    return {
      ready: true as const,
      status: order.status,
      token: buildHandoverToken(order.id, data.kind, sig),
      code: shortCodeFromSignature(sig),
    };
  });

export const verifyHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        orderId: orderIdSchema,
        token: z.string().trim().max(200).optional(),
        code: z.string().trim().max(10).optional(),
      })
      .refine((v) => !!v.token || !!v.code, { message: "Scan the QR code or type the 4-digit code." }),
  )
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, status, rider_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.rider_id !== context.userId) throw new Error("This is not your delivery.");
    const kind: HandoverKind | null = expectedHandoverKind(order.status);
    if (!kind) throw new Error("This delivery doesn't need a code right now.");
    const who = kind === "pickup" ? "the shop" : "the customer";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("order_handover_codes")
      .select("nonce, failed_attempts, used_at")
      .eq("order_id", order.id)
      .eq("kind", kind)
      .maybeSingle();
    if (!row) throw new Error(`Ask ${who} to open their ${kind === "pickup" ? "pickup" : "delivery"} QR code first.`);
    if (row.used_at) throw new Error("This code has already been used.");
    if (row.failed_attempts >= MAX_FAILED_ATTEMPTS) throw new Error(`Too many wrong tries. Ask ${who} to reopen their code for a new one.`);

    const sig = await sign(handoverPayload(order.id, kind, row.nonce));
    if (!handoverMatches({ token: data.token ?? null, code: data.code ?? null }, { orderId: order.id, kind, signatureHex: sig })) {
      await supabaseAdmin
        .from("order_handover_codes")
        .update({ failed_attempts: row.failed_attempts + 1 })
        .eq("order_id", order.id)
        .eq("kind", kind)
        .is("used_at", null);
      const left = MAX_FAILED_ATTEMPTS - row.failed_attempts - 1;
      throw new Error(
        data.token
          ? `That QR code isn't for this ${kind === "pickup" ? "pickup" : "delivery"}.`
          : `Wrong code. ${left > 0 ? `${left} ${left === 1 ? "try" : "tries"} left.` : `Ask ${who} to reopen their code.`}`,
      );
    }

    const { data: status, error } = await supabaseAdmin.rpc("service_complete_handover", {
      _order_id: order.id,
      _kind: kind,
      _rider_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { kind, status: status as string };
  });
