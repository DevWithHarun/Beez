import type { Tables } from "@/integrations/supabase/types";

export type MerchantOrder = Tables<"orders">;
export type MerchantProduct = Tables<"products">;
export type MerchantItem = Tables<"order_items">;
export type MerchantCampaign = Tables<"merchant_campaigns">;
export type MerchantCampaignRedemption = Tables<"merchant_campaign_redemptions">;
export type MerchantPayout = Tables<"merchant_payout_requests">;
export type MerchantSnapshot = {
  merchant: Tables<"merchants"> | null;
  orders: MerchantOrder[];
  products: MerchantProduct[];
  items: MerchantItem[];
  campaigns: MerchantCampaign[];
  redemptions: MerchantCampaignRedemption[];
  payouts: MerchantPayout[];
};
export function productRevenue(order: MerchantOrder) {
  return Math.max(0, order.total_kes - order.delivery_fee_kes - order.service_fee_kes);
}
export function confirmed(order: MerchantOrder) {
  return order.payment_status === "Paid" && order.status !== "Cancelled";
}
export function merchantSummary(orders: MerchantOrder[], range: string, now = new Date()) {
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const days =
    range === "This month"
      ? local.getDate()
      : range === "This week"
        ? ((local.getDay() + 6) % 7) + 1
        : 1;
  const end = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate() + 1) - 3 * 3600000;
  const start = end - days * 86400000;
  const selected = orders.filter(
    (o) =>
      Date.parse(o.created_at) >= start &&
      Date.parse(o.created_at) < end &&
      o.status !== "Cancelled",
  );
  const paid = selected.filter(confirmed);
  const sales = paid.reduce((sum, o) => sum + productRevenue(o), 0);
  const customers = new Set(selected.map((o) => o.customer_id || o.customer_phone).filter(Boolean))
    .size;
  const chart = Array.from({ length: days === 1 ? 24 : days }, (_, i) => {
    const a = start + i * (days === 1 ? 3600000 : 86400000);
    const b = a + (days === 1 ? 3600000 : 86400000);
    return {
      time:
        days === 1
          ? `${i}:00`
          : new Date(a).toLocaleDateString("en-KE", {
              timeZone: "Africa/Nairobi",
              day: "numeric",
              month: "short",
            }),
      sales: paid
        .filter((o) => Date.parse(o.created_at) >= a && Date.parse(o.created_at) < b)
        .reduce((sum, o) => sum + productRevenue(o), 0),
    };
  });
  return {
    sales,
    count: selected.length,
    customers,
    average: paid.length ? Math.round(sales / paid.length) : 0,
    chart,
  };
}
export function bestProducts(orders: MerchantOrder[], items: MerchantItem[]) {
  const paid = new Set(orders.filter(confirmed).map((o) => o.id));
  const totals = new Map<string, { name: string; sold: number; revenue: number }>();
  for (const item of items) {
    if (!paid.has(item.order_id)) continue;
    const key = item.product_id || item.product_name;
    const current = totals.get(key) ?? { name: item.product_name, sold: 0, revenue: 0 };
    current.sold += item.quantity;
    current.revenue += item.quantity * item.unit_price_kes;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
}
export function merchantCustomers(orders: MerchantOrder[]) {
  const customers = new Map<
    string,
    {
      key: string;
      name: string;
      phone: string;
      orders: number;
      paidOrders: number;
      paidTotal: number;
      lastOrderAt: string;
    }
  >();
  for (const order of orders) {
    let phone = order.customer_phone.replace(/\D/g, "");
    if (phone.length === 10 && phone.startsWith("0")) phone = `254${phone.slice(1)}`;
    else if (phone.length === 9 && /^[17]/.test(phone)) phone = `254${phone}`;
    const key = order.customer_id || (phone ? `phone:${phone}` : `order:${order.id}`);
    const customer = customers.get(key) ?? {
      key,
      name: order.customer_name.trim() || "Guest customer",
      phone: order.customer_phone,
      orders: 0,
      paidOrders: 0,
      paidTotal: 0,
      lastOrderAt: order.created_at,
    };
    customer.orders += 1;
    if (confirmed(order)) {
      customer.paidOrders += 1;
      customer.paidTotal += productRevenue(order);
    }
    if (Date.parse(order.created_at) > Date.parse(customer.lastOrderAt)) {
      customer.lastOrderAt = order.created_at;
      customer.name = order.customer_name.trim() || customer.name;
      customer.phone = order.customer_phone || customer.phone;
    }
    customers.set(key, customer);
  }
  return [...customers.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

export function merchantPaymentSummary(orders: MerchantOrder[]) {
  const relevant = orders.filter((order) => order.status !== "Cancelled");
  return {
    paid: relevant.filter(confirmed),
    pending: relevant.filter((order) => order.payment_status !== "Paid"),
    paidTotal: relevant.filter(confirmed).reduce((sum, order) => sum + productRevenue(order), 0),
    pendingTotal: relevant
      .filter((order) => order.payment_status !== "Paid")
      .reduce((sum, order) => sum + productRevenue(order), 0),
  };
}
export const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
