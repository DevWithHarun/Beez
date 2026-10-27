import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { MerchantSnapshot } from "./merchant-data";

const merchantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  area: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30),
  category: z.string().trim().min(1).max(100),
  business_type: z.string().max(40),
  image_url: z.string().url().nullable().optional(),
});
export const saveMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(merchantSchema)
  .handler(async ({ data, context }) => {
    const { image_url, ...merchantData } = data;
    const { data: merchant, error } = await context.supabase
      .from("merchants")
      .upsert(
        { ...merchantData, ...(image_url !== undefined ? { image_url } : {}), owner_id: context.userId },
        { onConflict: "owner_id" },
      )
      .select()
      .single();
    if (error) throw new Error("Your business details could not be saved. Please try again.");
    return merchant;
  });
export const getMerchantDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchantSnapshot> => {
    const { data: merchant, error } = await context.supabase
      .from("merchants")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Your business could not be loaded. Please try again.");
    if (!merchant)
      return {
        merchant: null,
        orders: [],
        products: [],
        items: [],
        campaigns: [],
        redemptions: [],
        payouts: [],
      };
    const orders: MerchantSnapshot["orders"] = [],
      products: MerchantSnapshot["products"] = [],
      items: MerchantSnapshot["items"] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase
        .from("orders")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (result.error) throw new Error("Orders could not be loaded. Please try again.");
      orders.push(...result.data);
      if (result.data.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase
        .from("products")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (result.error) throw new Error("Products could not be loaded. Please try again.");
      products.push(...result.data);
      if (result.data.length < 500) break;
    }
    for (let offset = 0; offset < orders.length; offset += 100) {
      const ids = orders.slice(offset, offset + 100).map((o) => o.id);
      for (let page = 0; ; page += 500) {
        const result = await context.supabase
          .from("order_items")
          .select("*")
          .in("order_id", ids)
          .order("id")
          .range(page, page + 499);
        if (result.error) throw new Error("Order items could not be loaded. Please try again.");
        items.push(...result.data);
        if (result.data.length < 500) break;
      }
    }
    const [campaignResult, redemptionResult, payoutResult] = await Promise.all([
      context.supabase
        .from("merchant_campaigns")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("merchant_campaign_redemptions")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("merchant_payout_requests")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false }),
    ]);
    if (campaignResult.error)
      throw new Error("Marketing campaigns could not be loaded. Please try again.");
    if (redemptionResult.error)
      throw new Error("Campaign redemptions could not be loaded. Please try again.");
    if (payoutResult.error)
      throw new Error("Payout requests could not be loaded. Please try again.");
    return {
      merchant,
      orders,
      products,
      items,
      campaigns: campaignResult.data,
      redemptions: redemptionResult.data,
      payouts: payoutResult.data,
    };
  });
const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(100),
  price_kes: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  active: z.boolean(),
  image_url: z.string().url().nullable(),
});
export const saveMerchantProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(productSchema)
  .handler(async ({ data, context }) => {
    const { data: merchant, error } = await context.supabase
      .from("merchants")
      .select("id")
      .eq("owner_id", context.userId)
      .single();
    if (error || !merchant) throw new Error("Save your business details first.");
    const { id, ...values } = data;
    const request = id
      ? context.supabase.from("products").update(values).eq("id", id).eq("merchant_id", merchant.id)
      : context.supabase.from("products").insert({ ...values, merchant_id: merchant.id });
    const result = await request.select().single();
    if (result.error) throw new Error("The product could not be saved. Please try again.");
    return result.data;
  });
export const prepareMerchantOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().min(1), status: z.enum(["Ready for Pickup", "Cancelled"]) }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("merchant_prepare_order", {
      _order_id: data.id,
      _status: data.status,
    });
    if (error) throw new Error("This order cannot be changed. Refresh and try again.");
    return { success: true };
  });

const campaignSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z.number().int().positive().max(1000000),
    minimum_order_kes: z.number().int().nonnegative(),
    maximum_discount_kes: z.number().int().positive().nullable(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    usage_limit: z.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .refine((campaign) => campaign.ends_at > campaign.starts_at, {
    message: "End time must be after start time",
    path: ["ends_at"],
  })
  .refine((campaign) => campaign.discount_type !== "percent" || campaign.discount_value <= 100, {
    message: "Percentage discounts cannot exceed 100%",
    path: ["discount_value"],
  });

export const saveMerchantCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campaignSchema)
  .handler(async ({ data, context }) => {
    const { data: merchant, error: merchantError } = await context.supabase
      .from("merchants")
      .select("id")
      .eq("owner_id", context.userId)
      .single();
    if (merchantError || !merchant) throw new Error("Your merchant profile could not be verified.");
    const { id, ...values } = data;
    const result = id
      ? await context.supabase
          .from("merchant_campaigns")
          .update(values)
          .eq("id", id)
          .eq("merchant_id", merchant.id)
          .select()
          .single()
      : await context.supabase
          .from("merchant_campaigns")
          .insert({ ...values, merchant_id: merchant.id })
          .select()
          .single();
    if (result.error)
      throw new Error(
        "The campaign could not be saved. Check that its code is not already in use.",
      );
    return result.data;
  });

export const requestMerchantPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      amount_kes: z.number().int().positive(),
      idempotency_key: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: payoutId, error } = await context.supabase.rpc("merchant_request_payout", {
      _amount_kes: data.amount_kes,
      _idempotency_key: data.idempotency_key,
    });
    if (error || !payoutId)
      throw new Error(error?.message ?? "The payout request could not be created.");
    const { data: payout, error: loadError } = await context.supabase
      .from("merchant_payout_requests")
      .select("*")
      .eq("id", payoutId)
      .single();
    if (loadError || !payout)
      throw new Error("The payout request was recorded but its status could not be loaded.");
    return payout;
  });
