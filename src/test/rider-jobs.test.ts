import { describe, expect, it } from "vitest";
import {
  OFFER_SECONDS,
  newOfferIds,
  normalizePlate,
  offerSecondsLeft,
  openOffers,
  riderNextStep,
  shiftDuration,
  todayTimeline,
  trackOfferSightings,
  walletLedger,
} from "@/lib/rider-jobs";

describe("job offers", () => {
  it("each offer gives the rider 45 seconds", () => {
    expect(OFFER_SECONDS).toBe(45);
    expect(offerSecondsLeft(0, 0)).toBe(45);
    expect(offerSecondsLeft(0, 30_000)).toBe(15);
    expect(offerSecondsLeft(0, 46_000)).toBe(0);
  });

  it("an offer keeps its first-seen time and disappears after 45s or when skipped", () => {
    const seen = trackOfferSightings({}, [{ id: "A" }], 1_000);
    const later = trackOfferSightings(seen, [{ id: "A" }, { id: "B" }], 40_000);
    expect(later).toEqual({ A: 1_000, B: 40_000 });
    const open = openOffers([{ id: "A" }, { id: "B" }, { id: "C" }], later, new Set(["C"]), 47_000);
    expect(open.map((o) => o.offer.id)).toEqual(["B"]);
    expect(open[0]!.secondsLeft).toBe(38);
  });

  it("only jobs not already on screen ring the chime", () => {
    expect(newOfferIds(new Set(["A"]), [{ id: "A" }, { id: "B" }])).toEqual(["B"]);
  });
});

describe("next delivery step", () => {
  it("pickup and drop-off need a scan; in between the rider taps arriving", () => {
    expect(riderNextStep("Assigned")).toMatchObject({ kind: "scan", handover: "pickup" });
    expect(riderNextStep("In Transit")).toMatchObject({ kind: "arriving" });
    expect(riderNextStep("Out for Delivery")).toMatchObject({ kind: "scan", handover: "dropoff" });
    expect(riderNextStep("Delivered")).toBeNull();
  });
});

describe("wallet ledger", () => {
  const settlements = [
    {
      order_id: "O1",
      rider_amount_kes: 200,
      cash_collected_kes: 0,
      trip_km: 2,
      settled_at: "2026-11-15T08:00:00Z",
    },
    {
      order_id: "O2",
      rider_amount_kes: 150,
      cash_collected_kes: 900,
      trip_km: 1.5,
      settled_at: "2026-11-15T10:00:00Z",
    },
  ];
  it("earnings add up, sent or pending payouts come off, failed payouts don't", () => {
    const w = walletLedger(settlements, [
      { id: "P1", amount_kes: 100, status: "Paid", created_at: "2026-11-15T09:00:00Z" },
      { id: "P2", amount_kes: 50, status: "Failed", created_at: "2026-11-15T11:00:00Z" },
    ]);
    expect(w.earnedKes).toBe(350);
    expect(w.availableKes).toBe(250);
    expect(w.cashCollectedKes).toBe(900);
    expect(w.entries.map((e) => [e.id, e.balanceKes])).toEqual([
      ["p-P2", 250],
      ["e-O2", 250],
      ["p-P1", 100],
      ["e-O1", 200],
    ]);
  });
});

describe("today timeline", () => {
  it("shows today's shift start and status changes in Nairobi time, oldest first", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    const items = todayTimeline(
      [{ id: "O1", merchant_name: "Mama Mboga", customer_area: "Kilimani" }],
      [
        { id: "e1", order_id: "O1", status: "Delivered", created_at: "2026-11-15T09:30:00Z" },
        { id: "e2", order_id: "O1", status: "Assigned", created_at: "2026-11-15T09:00:00Z" },
        { id: "e3", order_id: "O1", status: "Assigned", created_at: "2026-11-14T20:59:00Z" }, // 23:59 yesterday Nairobi
        { id: "e4", order_id: "OTHER", status: "Delivered", created_at: "2026-11-15T09:40:00Z" },
      ],
      "2026-11-15T05:00:00Z",
      now,
    );
    expect(items.map((i) => i.title)).toEqual([
      "Went online",
      "Accepted job · O1",
      "Delivered · O1",
    ]);
  });

  it("shift timer shows hours and minutes", () => {
    expect(shiftDuration(null, 0)).toBeNull();
    expect(shiftDuration("2026-11-15T08:00:00Z", Date.parse("2026-11-15T09:05:30Z"))).toBe(
      "1h 05m",
    );
    expect(shiftDuration("2026-11-15T08:00:00Z", Date.parse("2026-11-15T08:12:00Z"))).toBe("12m");
  });
});

describe("number plates", () => {
  it("formats Kenyan plates and rejects junk", () => {
    expect(normalizePlate("kmfa123b")).toBe("KMFA 123B");
    expect(normalizePlate("KDA 456X")).toBe("KDA 456X");
    expect(normalizePlate("  ")).toBeNull();
    expect(normalizePlate("123")).toBeUndefined();
  });
});
