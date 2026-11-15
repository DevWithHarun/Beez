import { describe, expect, it } from "vitest";
import { countdownPhase, formatCountdown, parseCommand, resolveTarget, say, type AgentOrder } from "@/lib/order-agent";

const order = (id: string, product: string, overrides: Partial<AgentOrder> = {}): AgentOrder => ({
  id,
  total_kes: 1000,
  payment_status: "Paid",
  customer_name: "",
  customer_area: "Nyali",
  is_guest: true,
  items_summary: product,
  items: [{ product_name: product, quantity: 1, unit_price_kes: 1000 }],
  deadline_at: new Date(Date.now() + 120_000).toISOString(),
  created_at: new Date().toISOString(),
  ...overrides,
});

const jacket = order("BEE102481", "Blue jacket");
const shoes = order("BEE102482", "Black shoes");

describe("order assistant understands merchants", () => {
  it("accepts in English", () => {
    expect(parseCommand("Yes, accept the order for me. I'm busy.", [jacket]).intent).toBe("accept");
  });
  it("accepts in Kiswahili", () => {
    expect(parseCommand("Ndiyo, kubali oda hii", [jacket]).intent).toBe("accept");
  });
  it("declines in English and Kiswahili", () => {
    expect(parseCommand("Decline it, out of stock", [jacket]).intent).toBe("decline");
    expect(parseCommand("Hapana, kataa", [jacket]).intent).toBe("decline");
  });
  it("treats 'don't accept' as a decline, never an accept", () => {
    expect(parseCommand("Don't accept that one", [jacket]).intent).toBe("decline");
    expect(parseCommand("usikubali", [jacket]).intent).toBe("decline");
  });
  it("finds the order from its spoken number", () => {
    expect(parseCommand("accept order 2482", [jacket, shoes]).orderId).toBe("BEE102482");
  });
  it("finds the order from the product name", () => {
    expect(parseCommand("accept the jacket", [jacket, shoes]).orderId).toBe("BEE102481");
  });
  it("leaves unclear speech for further interpretation", () => {
    expect(parseCommand("hmm what is this", [jacket]).intent).toBe("unknown");
  });
});

describe("order assistant picks the right order", () => {
  it("acts on the only waiting order", () => {
    expect(resolveTarget({ orderId: null }, [jacket])).toEqual({ kind: "execute", orderId: jacket.id });
  });
  it("asks which one when two orders are waiting and none was named", () => {
    expect(resolveTarget({ orderId: null }, [jacket, shoes])).toEqual({ kind: "ask_which" });
  });
  it("does nothing when no order is waiting", () => {
    expect(resolveTarget({ orderId: null }, [])).toEqual({ kind: "none_waiting" });
  });
});

describe("order response countdown (2 minute window)", () => {
  const total = 120_000;
  it("starts with the initial alert", () => {
    expect(countdownPhase(119_000, total)).toBe("initial");
  });
  it("repeats the announcement midway", () => {
    expect(countdownPhase(60_000, total)).toBe("midway");
  });
  it("is urgent in the last 20 seconds", () => {
    expect(countdownPhase(20_000, total)).toBe("urgent");
  });
  it("expires at the deadline", () => {
    expect(countdownPhase(0, total)).toBe("expired");
  });
  it("shows minutes and seconds", () => {
    expect(formatCountdown(120_000)).toBe("02:00");
    expect(formatCountdown(42_100)).toBe("00:43");
  });
});

describe("spoken replies", () => {
  it("only says Done for a server-confirmed acceptance", () => {
    expect(say.accepted(jacket, jacket.id, "en")).toMatch(/^Done!/);
    expect(say.expired(jacket.id, "en")).not.toMatch(/Done/);
    expect(say.failed("en")).not.toMatch(/Done/);
  });
  it("speaks Kiswahili when selected", () => {
    expect(say.newOrder(jacket, 120_000, "sw")).toContain("Una oda mpya");
  });
});
