// Merchant analytics: pure calculations over a shop's saved orders and order items.
// All periods follow the Nairobi calendar (UTC+3, no daylight saving).
import type { MerchantItem, MerchantOrder, MerchantProduct } from "@/lib/merchant-data";
import { confirmed, productRevenue } from "@/lib/merchant-data";

export const ANALYTICS_PERIODS = ["Today", "This week", "This month", "Last 30 days", "All time"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NAIROBI_OFFSET = 3 * HOUR;

/** Midnight (as a UTC timestamp) of the Nairobi day containing `ms`. */
export function nairobiDayStart(ms: number) {
  const shifted = new Date(ms + NAIROBI_OFFSET);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - NAIROBI_OFFSET;
}

function nairobiParts(ms: number) {
  const d = new Date(ms + NAIROBI_OFFSET);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate(), weekday: d.getUTCDay(), hour: d.getUTCHours() };
}

function monthStart(year: number, month: number) {
  return Date.UTC(year, month, 1) - NAIROBI_OFFSET;
}

export type Bucket = { start: number; end: number; label: string };
export type PeriodWindow = {
  start: number;
  end: number;
  /** Equal-length window just before `start`; null when there is nothing to compare with. */
  previous: { start: number; end: number } | null;
  compareLabel: string;
  buckets: Bucket[];
};

const shortDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short" });
const shortMonth = (ms: number) =>
  new Date(ms).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", month: "short", year: "2-digit" });

export function hourLabel(hour: number) {
  const fmt = (h: number) => {
    const n = h % 24;
    return `${n % 12 === 0 ? 12 : n % 12}${n < 12 ? "am" : "pm"}`;
  };
  return `${fmt(hour)}–${fmt(hour + 1)}`;
}

function dailyBuckets(start: number, end: number): Bucket[] {
  const out: Bucket[] = [];
  for (let a = start; a < end; a += DAY) out.push({ start: a, end: a + DAY, label: shortDay(a) });
  return out;
}

export function periodWindow(period: AnalyticsPeriod, orders: MerchantOrder[], now = Date.now()): PeriodWindow {
  const today = nairobiDayStart(now);
  const tomorrow = today + DAY;
  const p = nairobiParts(now);
  if (period === "Today") {
    // Compare with yesterday up to the same time, so a morning isn't judged against a whole day.
    return {
      start: today,
      end: tomorrow,
      previous: { start: today - DAY, end: now - DAY },
      compareLabel: "vs yesterday by this time",
      buckets: Array.from({ length: 24 }, (_, h) => ({
        start: today + h * HOUR,
        end: today + (h + 1) * HOUR,
        label: `${h}:00`,
      })),
    };
  }
  if (period === "All time") {
    const first = orders.reduce((min, o) => Math.min(min, Date.parse(o.created_at)), now);
    const f = nairobiParts(first);
    const buckets: Bucket[] = [];
    let y = f.year;
    let m = f.month;
    while (monthStart(y, m) < tomorrow) {
      const a = monthStart(y, m);
      const b = monthStart(m === 11 ? y + 1 : y, (m + 1) % 12);
      buckets.push({ start: a, end: b, label: shortMonth(a) });
      if (m === 11) y += 1;
      m = (m + 1) % 12;
    }
    const start = buckets[0]?.start ?? monthStart(p.year, p.month);
    const end = buckets[buckets.length - 1]?.end ?? tomorrow;
    return { start, end, previous: null, compareLabel: "", buckets };
  }
  if (period === "This week") {
    // Monday to now, compared with last week's Monday up to the same day and time.
    const start = today - ((p.weekday + 6) % 7) * DAY;
    return {
      start,
      end: tomorrow,
      previous: { start: start - 7 * DAY, end: now - 7 * DAY },
      compareLabel: "vs last week so far",
      buckets: dailyBuckets(start, tomorrow),
    };
  }
  if (period === "This month") {
    // 1st to now, compared with last month's 1st up to the same point (capped at last month's end).
    const start = monthStart(p.year, p.month);
    const prevStart = p.month === 0 ? monthStart(p.year - 1, 11) : monthStart(p.year, p.month - 1);
    return {
      start,
      end: tomorrow,
      previous: { start: prevStart, end: Math.min(prevStart + (now - start), start) },
      compareLabel: "vs last month so far",
      buckets: dailyBuckets(start, tomorrow),
    };
  }
  const start = tomorrow - 30 * DAY;
  return {
    start,
    end: tomorrow,
    previous: { start: start - 30 * DAY, end: start },
    compareLabel: "vs the 30 days before",
    buckets: dailyBuckets(start, tomorrow),
  };
}

/** Same customer whether they ordered signed in or as a guest with the same phone. */
export function customerKey(order: MerchantOrder) {
  if (order.customer_id) return order.customer_id;
  let phone = (order.customer_phone || "").replace(/\D/g, "");
  if (phone.length === 10 && phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  else if (phone.length === 9 && /^[17]/.test(phone)) phone = `254${phone}`;
  return phone ? `phone:${phone}` : `order:${order.id}`;
}

export const isPickup = (order: MerchantOrder) => order.delivery_fee_kes === 0;
export const isMpesa = (order: MerchantOrder) => order.payment_method === "M-Pesa";

/** Percentage change, or null when there was nothing before to compare with. */
export function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function within(orders: MerchantOrder[], start: number, end: number) {
  return orders.filter((o) => {
    const t = Date.parse(o.created_at);
    return t >= start && t < end;
  });
}

function totals(orders: MerchantOrder[]) {
  const paid = orders.filter(confirmed);
  const revenue = paid.reduce((sum, o) => sum + productRevenue(o), 0);
  return {
    // Cancelled orders are reported separately, never as orders received.
    received: orders.filter((o) => o.status !== "Cancelled").length,
    revenue,
    paid: paid.length,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    customers: new Set(orders.filter((o) => o.status !== "Cancelled").map(customerKey)).size,
  };
}

export type TopProduct = { key: string; productId: string | null; name: string; sold: number; revenue: number; imageUrl: string | null };

export function merchantAnalytics(
  period: AnalyticsPeriod,
  orders: MerchantOrder[],
  items: MerchantItem[],
  products: MerchantProduct[],
  now = Date.now(),
) {
  const window = periodWindow(period, orders, now);
  const current = within(orders, window.start, window.end);
  const now_ = totals(current);
  const prev = window.previous ? totals(within(orders, window.previous.start, window.previous.end)) : null;
  const live = current.filter((o) => o.status !== "Cancelled");
  const paid = current.filter(confirmed);

  // Returning = this customer had an order with the shop before the period started.
  const earlier = new Set(
    orders
      .filter((o) => o.status !== "Cancelled" && Date.parse(o.created_at) < window.start)
      .map(customerKey),
  );
  const customerKeys = new Set(live.map(customerKey));
  const returning = [...customerKeys].filter((k) => earlier.has(k)).length;

  const cancelled = current.filter((o) => o.status === "Cancelled").length;
  const awaiting = live.filter((o) => o.payment_status !== "Paid");

  const split = (list: MerchantOrder[], test: (o: MerchantOrder) => boolean) => {
    const yes = list.filter(test);
    return {
      count: yes.length,
      revenue: yes.reduce((s, o) => s + productRevenue(o), 0),
    };
  };

  const hours = Array.from({ length: 24 }, () => 0);
  for (const o of live) {
    const h = nairobiParts(Date.parse(o.created_at)).hour;
    hours[h] = (hours[h] ?? 0) + 1;
  }
  const peak = Math.max(...hours);
  const busiestHour = peak > 0 ? hours.indexOf(peak) : null;

  const paidIds = new Set(paid.map((o) => o.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  const productTotals = new Map<string, TopProduct>();
  for (const item of items) {
    if (!paidIds.has(item.order_id)) continue;
    const key = item.product_id || item.product_name;
    const row = productTotals.get(key) ?? {
      key,
      productId: item.product_id,
      name: item.product_name,
      sold: 0,
      revenue: 0,
      imageUrl: (item.product_id && byId.get(item.product_id)?.image_url) || null,
    };
    row.sold += item.quantity;
    row.revenue += item.quantity * item.unit_price_kes;
    productTotals.set(key, row);
  }
  const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue || b.sold - a.sold).slice(0, 5);

  const lowStock = products
    .filter((p) => p.active && p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  const series = window.buckets.map((b) => {
    const inBucket = within(current, b.start, b.end);
    const paidInBucket = inBucket.filter(confirmed);
    const revenue = paidInBucket.reduce((s, o) => s + productRevenue(o), 0);
    const liveInBucket = inBucket.filter((o) => o.status !== "Cancelled");
    return {
      label: b.label,
      revenue,
      orders: liveInBucket.length,
      average: paidInBucket.length ? Math.round(revenue / paidInBucket.length) : 0,
      customers: new Set(liveInBucket.map(customerKey)).size,
    };
  });

  return {
    window,
    revenue: now_.revenue,
    revenueChange: prev ? percentChange(now_.revenue, prev.revenue) : null,
    orders: now_.received,
    ordersChange: prev ? percentChange(now_.received, prev.received) : null,
    paidOrders: now_.paid,
    average: now_.average,
    averageChange: prev ? percentChange(now_.average, prev.average) : null,
    customers: now_.customers,
    customersChange: prev ? percentChange(now_.customers, prev.customers) : null,
    newCustomers: customerKeys.size - returning,
    returningCustomers: returning,
    cancelled,
    cancelRate: current.length ? Math.round((cancelled / current.length) * 100) : 0,
    awaitingCount: awaiting.length,
    awaitingValue: awaiting.reduce((s, o) => s + productRevenue(o), 0),
    mpesa: split(paid, isMpesa),
    cash: split(paid, (o) => !isMpesa(o)),
    delivery: live.filter((o) => !isPickup(o)).length,
    pickup: live.filter(isPickup).length,
    busiestHour,
    busiestHourOrders: peak,
    topProducts,
    lowStock,
    series,
    periodOrders: current,
  };
}

export type MerchantAnalytics = ReturnType<typeof merchantAnalytics>;

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of the period's orders for the merchant's own records. */
export function ordersCsv(orders: MerchantOrder[]) {
  const header = ["Order", "Date (Nairobi)", "Customer", "Phone", "Items", "Product total (KES)", "Delivery fee (KES)", "Total (KES)", "Payment method", "Payment status", "Order status", "Delivery or pickup"];
  const rows = orders.map((o) => [
    o.id,
    new Date(o.created_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
    o.customer_name,
    o.customer_phone,
    o.items_summary,
    productRevenue(o),
    o.delivery_fee_kes,
    o.total_kes,
    o.payment_method,
    o.payment_status,
    o.status,
    isPickup(o) ? "Pickup" : "Delivery",
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
