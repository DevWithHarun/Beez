// Pure, browser-safe builders for customer text messages (English + Kiswahili)
// and refund/order wording shared by the server sender and the app screens.

export type CustomerMessageKind = "order_declined" | "order_expired" | "refund_sent";

export interface CustomerMessageDetails {
  merchant_name?: string;
  total_kes?: number;
  payment_method?: string;
  refund_due?: boolean;
  reference?: string;
}

const kes = (n: number | undefined) => `KES ${Math.max(0, Math.round(n ?? 0)).toLocaleString("en-KE")}`;
const shop = (d: CustomerMessageDetails) => (d.merchant_name || "").trim() || "The shop";

/** One SMS containing English first, then Kiswahili. */
export function buildCustomerSms(kind: CustomerMessageKind, orderId: string, d: CustomerMessageDetails): string {
  const amount = kes(d.total_kes);
  if (kind === "refund_sent") {
    const ref = d.reference ? ` (M-Pesa ${d.reference})` : "";
    return [
      `Beez: Your refund of ${amount} for order ${orderId} has been sent${ref}.`,
      `Marejesho ya ${amount} ya oda ${orderId} yametumwa${ref}.`,
    ].join(" ");
  }

  const name = shop(d);
  const en =
    kind === "order_declined"
      ? `Beez: Sorry, ${name} couldn't take order ${orderId}, so it was cancelled.`
      : `Beez: ${name} didn't confirm order ${orderId} in time, so it was cancelled.`;
  const sw =
    kind === "order_declined"
      ? `Samahani, ${name} hawakuweza kupokea oda ${orderId}, imeghairiwa.`
      : `${name} hawakuthibitisha oda ${orderId} kwa wakati, imeghairiwa.`;
  const moneyEn = d.refund_due
    ? `Your ${amount} refund is being processed.`
    : "You have not been charged.";
  const moneySw = d.refund_due ? `Marejesho ya ${amount} yanashughulikiwa.` : "Hujatozwa pesa.";
  return `${en} ${moneyEn} ${sw} ${moneySw}`;
}

/** What the customer sees on the order screen once a shop declines or doesn't answer. */
export function cancellationNotice(order: {
  status: string;
  merchant_name: string;
  merchant_response?: string | null;
  payment_status: string;
  total_kes: number;
}): { title: string; body: string; money: string } | null {
  if (order.status !== "Cancelled") return null;
  const name = order.merchant_name || "The shop";
  let title: string;
  let body: string;
  if (order.merchant_response === "declined") {
    title = "The shop couldn't take this order";
    body = `${name} declined your order, so it was cancelled.`;
  } else if (order.merchant_response === "expired") {
    title = "The shop didn't confirm in time";
    body = `${name} didn't confirm your order within the time limit, so it was cancelled.`;
  } else {
    title = "Order cancelled";
    body = "This order was cancelled.";
  }
  const amount = kes(order.total_kes);
  const money =
    order.payment_status === "Refund Pending"
      ? `Your refund of ${amount} is being processed. We'll text you when it's sent.`
      : order.payment_status === "Refunded"
        ? `Your refund of ${amount} has been sent.`
        : order.payment_status === "Paid"
          ? "Contact Beez support about your payment."
          : "You have not been charged.";
  return { title, body, money };
}

/** M-Pesa transaction codes are 8-12 letters/numbers, e.g. SKL4ABCD12. */
export function normalizeMpesaReference(input: string): string | null {
  const ref = input.trim().toUpperCase();
  return /^[A-Z0-9]{8,12}$/.test(ref) ? ref : null;
}
