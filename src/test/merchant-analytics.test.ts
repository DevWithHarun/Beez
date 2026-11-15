import { describe, it, expect } from "vitest";
import { merchantAnalytics, periodWindow } from "@/lib/merchant-analytics";
import type { MerchantItem, MerchantOrder, MerchantProduct } from "@/lib/merchant-data";

const order = (values: Partial<MerchantOrder> = {}): MerchantOrder => ({
  id: "o1",
  created_at: "2026-10-20T08:00:00Z", // 11:00 Nairobi
  updated_at: "2026-10-20T08:00:00Z",
  merchant_id: "merchant",
  merchant_name: "Shop",
  campaign_id: null,
  discount_kes: 0,
  merchant_response: "not_required",
  merchant_response_deadline: null,
  merchant_responded_at: null,
  merchant_response_via: null,
  merchant_decline_reason: null,
  delivery_instructions: null,
  customer_id: null,
  customer_name: "Amina",
  customer_phone: "0700000001",
  customer_area: "",
  items_summary: "",
  payment_status: "Paid",
  payment_method: "M-Pesa",
  status: "Delivered",
  total_kes: 650,
  delivery_fee_kes: 50,
  service_fee_kes: 20,
  rider_id: null,
  assigned_at: null,
  delivered_at: null,
  rider_earning_kes: 0,
  pickup_area: "",
  pickup_lat: 0,
  pickup_lng: 0,
  drop_lat: 0,
  drop_lng: 0,
  rider_lat: null,
  rider_lng: null,
  rider_heading: null,
  rider_location_at: null,
  ...values,
});
const item = (order_id: string, values: Partial<MerchantItem> = {}): MerchantItem =>
  ({
    id: `item-${order_id}`,
    order_id,
    product_id: "p1",
    product_name: "Mango juice",
    quantity: 2,
    unit_price_kes: 290,
    created_at: "2026-10-20T08:00:00Z",
    ...values,
  }) as MerchantItem;
const product = { id: "p1", name: "Mango juice", image_url: "https://img/mango.jpg", active: true, stock: 20, price_kes: 290 } as MerchantProduct;

const now = Date.parse("2026-10-20T16:00:00Z"); // Tue 20 Oct, 19:00 Nairobi
const run = (orders: MerchantOrder[], items: MerchantItem[] = [], period: Parameters<typeof merchantAnalytics>[0] = "Today") =>
  merchantAnalytics(period, orders, items, [product], now);

describe("Analytics sales rules", () => {
  it("leaves unpaid orders out of paid sales and top products, and shows them as waiting to be paid", () => {
    const a = run([order(), order({ id: "unpaid", payment_status: "Unpaid", customer_phone: "0700000002" })], [item("o1"), item("unpaid")]);
    expect(a.revenue).toBe(580);
    expect(a.paidOrders).toBe(1);
    expect(a.average).toBe(580);
    expect(a.topProducts).toEqual([expect.objectContaining({ sold: 2, revenue: 580 })]);
    expect(a.awaitingCount).toBe(1);
    expect(a.awaitingValue).toBe(580);
  });

  it("leaves cancelled orders out of sales, orders and customers, even when they were paid", () => {
    const a = run(
      [order(), order({ id: "cancelled", status: "Cancelled", customer_phone: "0700000003" })],
      [item("o1"), item("cancelled")],
    );
    expect(a.revenue).toBe(580);
    expect(a.orders).toBe(1);
    expect(a.customers).toBe(1);
    expect(a.cancelled).toBe(1);
    expect(a.cancelRate).toBe(50);
    expect(a.awaitingCount).toBe(0);
    expect(a.topProducts[0]?.sold).toBe(2);
  });

  it("leaves delivery and service fees out of paid sales and the M-Pesa / cash split", () => {
    const a = run([
      order({ total_kes: 1200, delivery_fee_kes: 150, service_fee_kes: 50 }),
      order({ id: "cash", payment_method: "Cash", total_kes: 500, delivery_fee_kes: 0, service_fee_kes: 0 }),
    ]);
    expect(a.revenue).toBe(1500);
    expect(a.mpesa).toEqual({ count: 1, revenue: 1000 });
    expect(a.cash).toEqual({ count: 1, revenue: 500 });
    expect(a.delivery).toBe(1);
    expect(a.pickup).toBe(1);
  });

  it("uses the chosen Nairobi period and shows the product photo for top sellers", () => {
    const rows = [order(), order({ id: "sunday", created_at: "2026-10-18T09:00:00Z" })];
    expect(run(rows, [], "Today").orders).toBe(1);
    expect(run(rows, [], "This week").orders).toBe(1); // week starts Monday 19 Oct
    expect(run(rows, [], "This month").orders).toBe(2);
    expect(run(rows, [item("o1")]).topProducts[0]?.imageUrl).toBe("https://img/mango.jpg");
  });

  it("compares today with yesterday only up to the same time", () => {
    const w = periodWindow("Today", [], now);
    expect(w.previous).toEqual({ start: Date.parse("2026-10-18T21:00:00Z"), end: now - 86400000 });
    const a = run([
      order({ total_kes: 1070 }), // 1000 today
      order({ id: "y-early", created_at: "2026-10-19T08:00:00Z", total_kes: 570 }), // 500 yesterday morning
      order({ id: "y-late", created_at: "2026-10-19T18:00:00Z", total_kes: 5070 }), // after this time yesterday
    ]);
    expect(a.revenueChange).toBe(100);
  });

  it("counts a guest as returning when the same phone ordered before the period", () => {
    const a = run([
      order({ customer_phone: "+254 700 000 001" }),
      order({ id: "before", created_at: "2026-10-01T08:00:00Z", customer_phone: "0700000001" }),
      order({ id: "new", customer_phone: "0711111111" }),
    ]);
    expect(a.returningCustomers).toBe(1);
    expect(a.newCustomers).toBe(1);
  });
});
