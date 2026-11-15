import { describe, expect, it } from "vitest";
import {
  buildHandoverToken,
  canShowHandover,
  expectedHandoverKind,
  handoverMatches,
  normalizeShortCode,
  parseHandoverToken,
  shortCodeFromSignature,
} from "@/lib/handover";

const sig = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80";

describe("handover codes", () => {
  it("QR token round-trips and carries order, step and signature", () => {
    const token = buildHandoverToken("BZ123", "pickup", sig);
    expect(token).toBe("BEEZ1.BZ123.pickup.1a2b3c4d5e6f7081");
    expect(parseHandoverToken(token)).toEqual({ orderId: "BZ123", kind: "pickup", sig: "1a2b3c4d5e6f7081" });
    expect(parseHandoverToken("https://evil.example/x")).toBeNull();
    expect(parseHandoverToken("BEEZ1.BZ123.refund.1a2b3c4d5e6f7081")).toBeNull();
  });

  it("4-digit backup code comes from the same signature", () => {
    expect(shortCodeFromSignature(sig)).toBe(String(parseInt("1a2b3c4d", 16) % 10000).padStart(4, "0"));
    expect(shortCodeFromSignature("00000001ffff")).toBe("0001");
    expect(normalizeShortCode(" 48 29 ")).toBe("4829");
    expect(normalizeShortCode("482")).toBeNull();
  });

  it("accepts the right QR or code and rejects another order's or step's code", () => {
    const expected = { orderId: "BZ123", kind: "dropoff" as const, signatureHex: sig };
    expect(handoverMatches({ token: buildHandoverToken("BZ123", "dropoff", sig) }, expected)).toBe(true);
    expect(handoverMatches({ token: buildHandoverToken("BZ999", "dropoff", sig) }, expected)).toBe(false);
    expect(handoverMatches({ token: buildHandoverToken("BZ123", "pickup", sig) }, expected)).toBe(false);
    expect(handoverMatches({ code: shortCodeFromSignature(sig) }, expected)).toBe(true);
    expect(handoverMatches({ code: "0000" === shortCodeFromSignature(sig) ? "1111" : "0000" }, expected)).toBe(false);
  });

  it("pickup is scanned at the shop, drop-off at the customer", () => {
    expect(expectedHandoverKind("Assigned")).toBe("pickup");
    expect(expectedHandoverKind("In Transit")).toBeNull();
    expect(expectedHandoverKind("Out for Delivery")).toBe("dropoff");
    expect(expectedHandoverKind("Delivered")).toBeNull();
    expect(canShowHandover("pickup", "Assigned")).toBe(true);
    expect(canShowHandover("pickup", "In Transit")).toBe(false);
    expect(canShowHandover("dropoff", "Assigned")).toBe(false);
    expect(canShowHandover("dropoff", "Out for Delivery")).toBe(false);
    expect(canShowHandover("dropoff", "Out for Delivery", "2026-11-15T10:00:00Z")).toBe(true);
    expect(canShowHandover("dropoff", "In Transit", "2026-11-15T10:00:00Z")).toBe(false);
  });
});
