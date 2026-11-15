import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCommand, resolveTarget, type AgentIntent, type AgentOrder } from "./order-agent";

type AuthedContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

async function loadAwaitingOrders(context: AuthedContext): Promise<{
  merchantId: string | null;
  orders: AgentOrder[];
  responseSeconds: number;
}> {
  const { data: merchant, error } = await context.supabase
    .from("merchants")
    .select("id")
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Your business could not be loaded. Please try again.");
  if (!merchant) return { merchantId: null, orders: [], responseSeconds: 120 };

  // Persist expiry for anything past its server deadline before reading.
  const expired = await context.supabase.rpc("expire_overdue_merchant_responses");
  if (expired.error) console.error("Could not expire overdue merchant responses", expired.error);
  if (typeof expired.data === "number" && expired.data > 0) {
    const { dispatchQuietly } = await import("./followups.server");
    await dispatchQuietly();
  }

  const [ordersResult, policyResult] = await Promise.all([
    context.supabase
      .from("orders")
      .select(
        "id,total_kes,payment_status,customer_name,customer_area,customer_id,items_summary,merchant_response_deadline,created_at",
      )
      .eq("merchant_id", merchant.id)
      .eq("merchant_response", "awaiting")
      .eq("status", "Pending")
      .order("merchant_response_deadline", { ascending: true })
      .limit(20),
    context.supabase.from("order_response_policy").select("merchant_response_seconds").maybeSingle(),
  ]);
  if (ordersResult.error) throw new Error("Waiting orders could not be loaded. Please try again.");
  const rows = ordersResult.data ?? [];
  const itemsResult = rows.length
    ? await context.supabase
        .from("order_items")
        .select("order_id,product_name,quantity,unit_price_kes")
        .in(
          "order_id",
          rows.map((r) => r.id),
        )
    : { data: [], error: null };
  if (itemsResult.error) throw new Error("Order items could not be loaded. Please try again.");

  const orders: AgentOrder[] = rows
    .filter((r) => r.merchant_response_deadline)
    .map((r) => ({
      id: r.id,
      total_kes: r.total_kes,
      payment_status: r.payment_status,
      customer_name: r.customer_name,
      customer_area: r.customer_area,
      is_guest: !r.customer_id,
      items_summary: r.items_summary,
      deadline_at: r.merchant_response_deadline as string,
      created_at: r.created_at,
      items: (itemsResult.data ?? [])
        .filter((i) => i.order_id === r.id)
        .map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price_kes: i.unit_price_kes,
        })),
    }));
  return {
    merchantId: merchant.id,
    orders,
    responseSeconds: policyResult.data?.merchant_response_seconds ?? 120,
  };
}

export const getOrderAgentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = await loadAwaitingOrders(context);
    return { ...state, serverNow: new Date().toISOString() };
  });

const respondSchema = z.object({
  orderId: z.string().min(1).max(64),
  decision: z.enum(["accept", "decline"]),
  channel: z.enum(["voice", "touch"]),
  requestId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
  transcript: z.string().trim().max(500).optional(),
});

export type RespondOutcome = "accepted" | "declined" | "expired" | "not_awaiting";

export const respondToOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(respondSchema)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("merchant_respond_to_order", {
      _order_id: data.orderId,
      _decision: data.decision,
      _channel: data.channel,
      _request_id: data.requestId,
      ...(data.reason ? { _reason: data.reason } : {}),
      ...(data.transcript ? { _transcript: data.transcript } : {}),
    });
    if (error || !result) {
      console.error("merchant_respond_to_order failed", error);
      throw new Error("This order could not be updated. Nothing was changed.");
    }
    const parsed = z
      .object({
        outcome: z.enum(["accepted", "declined", "expired", "not_awaiting"]),
        order_id: z.string(),
        status: z.string(),
        merchant_response: z.string(),
      })
      .parse(result);
    if (parsed.outcome === "declined" || parsed.outcome === "expired") {
      // Tell the customer straight away (also woken by the database as a backstop).
      const { dispatchQuietly } = await import("./followups.server");
      await dispatchQuietly();
    }
    return parsed;
  });

const interpretSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  language: z.enum(["en", "sw"]),
});

export interface InterpretResult {
  intent: AgentIntent;
  orderId: string | null;
  resolution: "execute" | "ask_which" | "none_waiting" | "unknown_order" | "not_needed";
  needsConfirmation: boolean;
  source: "rules" | "ai";
}

const AI_INTENTS = ["accept", "decline", "repeat", "time_left", "list", "unknown"] as const;

async function interpretWithAi(
  transcript: string,
  language: "en" | "sw",
  orders: AgentOrder[],
): Promise<{ intent: AgentIntent; orderId: string | null; confident: boolean } | null> {
  const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
  const orderList = orders
    .map(
      (o, index) =>
        `${index + 1}. id=${o.id} items=${o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ") || o.items_summary} total=KES ${o.total_kes}`,
    )
    .join("\n");
  try {
    const response = await generateResponse({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      instructions:
        "You interpret what a Kenyan market merchant said to the Beez order assistant. They may speak English, Kiswahili, Sheng or mix them. Classify the intent about the waiting orders. Only choose accept or decline when the merchant clearly asked for it. Never guess an order id; use null unless the merchant clearly referred to one of the listed orders. Set confident=false when unsure.",
      input: [
        {
          role: "user",
          content: `Selected language: ${language}\nOrders waiting for a response:\n${orderList || "(none)"}\n\nMerchant said: "${transcript}"`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "order_command",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: { type: "string", enum: [...AI_INTENTS] },
              order_id: { type: ["string", "null"] },
              confident: { type: "boolean" },
            },
            required: ["intent", "order_id", "confident"],
          },
        },
      },
      max_output_tokens: 300,
    });
    const text = extractOutputText(response);
    if (!text) return null;
    const parsed = z
      .object({
        intent: z.enum(AI_INTENTS),
        order_id: z.string().nullable(),
        confident: z.boolean(),
      })
      .parse(JSON.parse(text));
    const orderId = parsed.order_id && orders.some((o) => o.id === parsed.order_id) ? parsed.order_id : null;
    return { intent: parsed.intent, orderId, confident: parsed.confident };
  } catch (error) {
    if (error instanceof GatewayError) console.error("Order command AI failed", error.code, error.ids);
    else console.error("Order command AI failed", error);
    return null;
  }
}

function extractOutputText(response: unknown): string | null {
  const r = response as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  return null;
}

export const interpretOrderCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(interpretSchema)
  .handler(async ({ data, context }): Promise<InterpretResult> => {
    const { orders } = await loadAwaitingOrders(context);
    let parsed = parseCommand(data.transcript, orders);
    let source: InterpretResult["source"] = "rules";
    let needsConfirmation = false;

    // Only spend AI on unclear speech while orders are actually waiting.
    if (parsed.intent === "unknown" && orders.length) {
      const ai = await interpretWithAi(data.transcript, data.language, orders);
      if (ai && ai.intent !== "unknown") {
        source = "ai";
        parsed = { intent: ai.intent, orderId: ai.orderId ?? parsed.orderId, explicitReference: Boolean(ai.orderId) };
        // AI-interpreted consequential commands are always confirmed first.
        needsConfirmation = parsed.intent === "accept" || parsed.intent === "decline";
      }
    }

    if (parsed.intent === "accept" || parsed.intent === "decline") {
      const resolution = resolveTarget(parsed, orders);
      return {
        intent: parsed.intent,
        orderId: resolution.kind === "execute" ? resolution.orderId : null,
        resolution: resolution.kind,
        needsConfirmation: resolution.kind === "execute" && needsConfirmation,
        source,
      };
    }
    return { intent: parsed.intent, orderId: parsed.orderId, resolution: "not_needed", needsConfirmation: false, source };
  });

export const transcribeOrderCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Expected audio upload");
    const audio = input.get("audio");
    const language = input.get("language");
    if (!(audio instanceof Blob) || audio.size === 0) throw new Error("No audio was recorded");
    if (audio.size > 2_000_000) throw new Error("The recording is too long. Keep it under 15 seconds.");
    return { audio, language: language === "sw" ? ("sw" as const) : ("en" as const) };
  })
  .handler(async ({ data }) => {
    const { transcribeAudio, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const result = await transcribeAudio({
        model: "openai/gpt-transcribe",
        file: data.audio,
        language: data.language,
        prompt: "Kenyan merchant answering a new order: accept, decline, kubali, kataa, ndiyo, hapana, order number.",
      });
      const text = typeof result === "string" ? result : (result as { text?: string }).text ?? "";
      return { transcript: text.trim() };
    } catch (error) {
      if (error instanceof GatewayError) console.error("Order command transcription failed", error.code, error.ids);
      else console.error("Order command transcription failed", error);
      throw new Error("Beez couldn't hear that clearly. Please try again or tap a button.");
    }
  });
