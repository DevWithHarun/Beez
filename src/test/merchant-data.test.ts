import { describe, it, expect } from "vitest";
import {
  merchantSummary,
  bestProducts,
  merchantCustomers,
  merchantPaymentSummary,
  type MerchantOrder,
} from "@/lib/merchant-data";
const order = (values: Partial<MerchantOrder> = {}): MerchantOrder => ({
  id: "real-order",
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  merchant_id: "merchant",
  merchant_name: "Shop",
  campaign_id: null,
  discount_kes: 0,
  customer_id: null,
  customer_name: "",
  customer_phone: "",
  customer_area: "",
  items_summary: "",
  payment_status: "Paid",
  payment_method: "",
  status: "Delivered",
  total_kes: 650,
  delivery_fee_kes: 50,
  service_fee_kes: 20,
  rider_id: null,
  assigned_at: null,
  delivered_at: null,
  rider_earning_kes: 100,
  pickup_area: "",
  pickup_lat: 0,
  pickup_lng: 0,
  drop_lat: 0,
  drop_lng: 0,
  rider_lat: null,
  rider_lng: null,
  ...values,
});
const now = new Date("2026-10-20T16:00:00Z");
describe("Real merchant data only", () => {
  it("does not manufacture sales, customers or orders for an empty business", () => {
    expect(merchantSummary([], "Today", now)).toMatchObject({
      sales: 0,
      count: 0,
      customers: 0,
      average: 0,
    });
    expect(bestProducts([], [])).toEqual([]);
  });
  it("separates paid product revenue from unpaid and cancelled orders", () => {
    expect(
      merchantSummary(
        [
          order(),
          order({ id: "unpaid", payment_status: "Pending" }),
          order({ id: "cancelled", status: "Cancelled" }),
        ],
        "Today",
        now,
      ).sales,
    ).toBe(580);
  });
  it("uses Nairobi date boundaries and selected periods", () => {
    const rows = [
      order({ created_at: "2026-10-19T21:00:00Z" }),
      order({ id: "earlier", created_at: "2026-10-19T20:59:59Z" }),
    ];
    expect(merchantSummary(rows, "Today", now).count).toBe(1);
    expect(merchantSummary(rows, "This week", now).count).toBe(2);
  });
  it("ranks sold products only from confirmed item records", () => {
    const item = {
      id: "i",
      order_id: "real-order",
      product_id: null,
      product_name: "Product",
      quantity: 2,
      unit_price_kes: 290,
      created_at: "2026-10-20T08:00:00Z",
    };
    expect(bestProducts([order()], [item])).toEqual([{ name: "Product", sold: 2, revenue: 580 }]);
    expect(bestProducts([order({ payment_status: "Pending" })], [item])).toEqual([]);
  });
  it("groups guest customers by normalized phone and totals confirmed product revenue", () => {
    const customers = merchantCustomers([
      order({ id: "first", customer_phone: "+254 700 000 001", customer_name: "Amina" }),
      order({
        id: "second",
        customer_phone: "0700000001",
        customer_name: "Amina N",
        total_kes: 400,
        created_at: "2026-10-20T09:00:00Z",
      }),
      order({ id: "third", customer_phone: "", customer_name: "Walk-in" }),
    ]);
    expect(customers).toHaveLength(2);
    expect(customers[0]).toMatchObject({
      name: "Amina N",
      orders: 2,
      paidOrders: 2,
      paidTotal: 910,
    });
  });
  it("summarizes paid and outstanding order product revenue without cancelled orders", () => {
    expect(
      merchantPaymentSummary([
        order(),
        order({ id: "pending", payment_status: "Unpaid", total_kes: 300 }),
        order({ id: "cancelled", status: "Cancelled", payment_status: "Pending" }),
      ]),
    ).toMatchObject({ paidTotal: 580, pendingTotal: 230 });
  });
});
