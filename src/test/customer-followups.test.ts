import { describe, expect, it } from "vitest";
import { buildCustomerSms, cancellationNotice, normalizeMpesaReference } from "@/lib/customer-messages";
import { workspaceGate } from "@/lib/identity-data";

describe("Customer text messages", () => {
  it("declined paid order tells the customer the refund amount, in English and Kiswahili", () => {
    const sms = buildCustomerSms("order_declined", "BEE123456", {
      merchant_name: "Mama Njeri Shop",
      total_kes: 1250,
      refund_due: true,
    });
    expect(sms).toContain("Mama Njeri Shop couldn't take order BEE123456");
    expect(sms).toContain("Your KES 1,250 refund is being processed.");
    expect(sms).toContain("Marejesho ya KES 1,250 yanashughulikiwa.");
  });

  it("expired cash order says the customer was not charged", () => {
    const sms = buildCustomerSms("order_expired", "BEE000111", {
      merchant_name: "Duka",
      total_kes: 500,
      refund_due: false,
    });
    expect(sms).toContain("didn't confirm order BEE000111 in time");
    expect(sms).toContain("You have not been charged.");
    expect(sms).toContain("Hujatozwa pesa.");
    expect(sms).not.toContain("refund");
  });

  it("refund sent message includes the M-Pesa code", () => {
    const sms = buildCustomerSms("refund_sent", "BEE1", { total_kes: 800, reference: "SKL4ABCD12" });
    expect(sms).toContain("KES 800");
    expect(sms).toContain("M-Pesa SKL4ABCD12");
  });
});

describe("Customer order screen notice", () => {
  const base = { merchant_name: "Duka", total_kes: 900 };
  it("shows refund in progress for a declined paid order", () => {
    const n = cancellationNotice({ ...base, status: "Cancelled", merchant_response: "declined", payment_status: "Refund Pending" });
    expect(n?.title).toBe("The shop couldn't take this order");
    expect(n?.money).toContain("KES 900 is being processed");
  });
  it("shows no charge when the shop didn't answer a cash order", () => {
    const n = cancellationNotice({ ...base, status: "Cancelled", merchant_response: "expired", payment_status: "Unpaid" });
    expect(n?.title).toBe("The shop didn't confirm in time");
    expect(n?.money).toBe("You have not been charged.");
  });
  it("shows nothing for an active order", () => {
    expect(cancellationNotice({ ...base, status: "Preparing", merchant_response: "accepted", payment_status: "Paid" })).toBeNull();
  });
});

describe("Admin refund recording", () => {
  it("accepts a valid M-Pesa code and upper-cases it", () => {
    expect(normalizeMpesaReference(" skl4abcd12 ")).toBe("SKL4ABCD12");
  });
  it("rejects codes that are too short or have symbols", () => {
    expect(normalizeMpesaReference("ABC12")).toBeNull();
    expect(normalizeMpesaReference("SKL4-ABCD1")).toBeNull();
  });
});

describe("Sell and Delivery for signed-out visitors", () => {
  it("Delivery asks signed-out visitors to sign in first", () => {
    expect(workspaceGate(null, "rider")).toBe("/login");
  });
});
