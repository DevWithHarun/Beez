import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { revenueOf, topMerchants, type AdminOrder } from "@/lib/admin-data";

const order = (values: Partial<AdminOrder> = {}) =>
  ({
    id: "o1",
    merchant_name: "Mama Shop",
    status: "Delivered",
    payment_status: "Paid",
    total_kes: 650,
    delivery_fee_kes: 50,
    service_fee_kes: 20,
    ...values,
  }) as AdminOrder;

describe("Admin home revenue", () => {
  it("counts only paid orders as revenue and reports unpaid ones as awaiting payment", () => {
    const r = revenueOf([order(), order({ id: "unpaid", payment_status: "Unpaid", total_kes: 300 })]);
    expect(r.total).toBe(650);
    expect(r.products).toBe(580);
    expect(r.delivery).toBe(50);
    expect(r.paidOrders).toBe(1);
    expect(r.awaiting).toBe(300);
    expect(r.awaitingOrders).toBe(1);
  });

  it("leaves cancelled orders out of revenue and out of awaiting payment, even if paid", () => {
    const r = revenueOf([order({ status: "Cancelled" }), order({ id: "c2", status: "Cancelled", payment_status: "Unpaid" })]);
    expect(r.total).toBe(0);
    expect(r.awaiting).toBe(0);
  });

  it("ranks top merchants by paid revenue only", () => {
    const top = topMerchants([
      order({ merchant_name: "Unpaid Big", payment_status: "Unpaid", total_kes: 9000 }),
      order({ id: "o2", merchant_name: "Paid Small", total_kes: 400 }),
    ]);
    expect(top[0]).toEqual({ name: "Paid Small", orders: 1, revenue: 400 });
    expect(top[1]).toEqual({ name: "Unpaid Big", orders: 1, revenue: 0 });
  });
});
