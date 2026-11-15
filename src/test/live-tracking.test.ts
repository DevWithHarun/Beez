import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  easeInOutCubic,
  fallbackEtaMinutes,
  gpsFreshness,
  haversineMeters,
  isImpossibleJump,
  lerpHeading,
  minutesUntil,
  parseOsrmRoute,
  routeWaypoints,
  shouldRefetchRoute,
  shouldSendPing,
  stageHeadline,
  trackingStep,
} from "@/lib/live-tracking";

const kilifi = { lat: -3.6305, lng: 39.8499 };

describe("GPS ping filtering", () => {
  it("sends at most one ping every 4 seconds", () => {
    const first = { ...kilifi, at: 0 };
    expect(shouldSendPing(null, first)).toBe(true);
    expect(shouldSendPing(first, { ...kilifi, at: 3_999 })).toBe(false);
    expect(shouldSendPing(first, { ...kilifi, at: 4_000 })).toBe(true);
  });

  it("rejects jumps faster than 45 m/s", () => {
    const a = { ...kilifi, at: 0 };
    // ~1.1 km north in 4 s ≈ 278 m/s
    const far = { lat: kilifi.lat + 0.01, lng: kilifi.lng, at: 4_000 };
    expect(isImpossibleJump(a, far)).toBe(true);
    expect(shouldSendPing(a, far)).toBe(false);
    // ~100 m in 4 s = 25 m/s (fast motorbike) is accepted
    const near = { lat: kilifi.lat + 0.0009, lng: kilifi.lng, at: 4_000 };
    expect(isImpossibleJump(a, near)).toBe(false);
  });

  it("rejects out-of-range and 0,0 coordinates", () => {
    expect(shouldSendPing(null, { lat: 91, lng: 39, at: 0 })).toBe(false);
    expect(shouldSendPing(null, { lat: 0, lng: 0, at: 0 })).toBe(false);
  });
});

describe("tracking stages", () => {
  it("maps statuses onto Confirmed → Preparing → Picked up → On the way → Delivered", () => {
    expect(trackingStep("Pending", "awaiting")).toBe(-1);
    expect(trackingStep("Pending", "accepted")).toBe(0);
    expect(trackingStep("Preparing")).toBe(1);
    expect(trackingStep("Assigned")).toBe(1);
    expect(trackingStep("In Transit")).toBe(2);
    expect(trackingStep("Out for Delivery")).toBe(3);
    expect(trackingStep("Delivered")).toBe(4);
    expect(trackingStep("Cancelled")).toBe(-1);
  });

  it("shows arrival instead of an outdated moving-to-customer headline", () => {
    const order = { status: "Out for Delivery", merchant_name: "Shop" };
    expect(stageHeadline(order)).toBe("Your rider is on the way to you");
    expect(stageHeadline({ ...order, riderArrivedAt: "2026-11-15T10:00:00Z" })).toBe(
      "Your rider has arrived",
    );
  });

  it("routes via the shop before pickup and straight home after", () => {
    const base = { pickup_lat: 1, pickup_lng: 1, drop_lat: 2, drop_lng: 2, rider_lat: 3, rider_lng: 3 };
    expect(routeWaypoints({ ...base, status: "Assigned" })).toHaveLength(3);
    expect(routeWaypoints({ ...base, status: "Out for Delivery" })).toEqual([
      { lat: 3, lng: 3 },
      { lat: 2, lng: 2 },
    ]);
    expect(routeWaypoints({ ...base, status: "Delivered" })).toBeNull();
  });
});

describe("route refresh and ETA", () => {
  it("refetches the road route only after 150 m and 30 s, or a stage change", () => {
    const last = { from: kilifi, at: 0, key: "Assigned:3" };
    const moved = { lat: kilifi.lat + 0.002, lng: kilifi.lng }; // ~220 m
    expect(shouldRefetchRoute(last, { from: moved, at: 10_000, key: "Assigned:3" })).toBe(false);
    expect(shouldRefetchRoute(last, { from: kilifi, at: 60_000, key: "Assigned:3" })).toBe(false);
    expect(shouldRefetchRoute(last, { from: moved, at: 30_000, key: "Assigned:3" })).toBe(true);
    expect(shouldRefetchRoute(last, { from: kilifi, at: 1_000, key: "In Transit:2" })).toBe(true);
  });

  it("estimates 18 km/h with a 1.3× detour when no road route", () => {
    const b = { lat: kilifi.lat + 0.09, lng: kilifi.lng }; // ~10 km
    expect(haversineMeters(kilifi, b)).toBeGreaterThan(9_900);
    expect(fallbackEtaMinutes([kilifi, b])).toBe(44);
  });

  it("counts down to arrival but never shows less than 1 minute", () => {
    expect(minutesUntil(10 * 60_000, 0)).toBe(10);
    expect(minutesUntil(0, 60_000)).toBe(1);
  });

  it("treats a location older than 30 s as not live", () => {
    const now = Date.parse("2026-11-15T10:00:30Z");
    expect(gpsFreshness("2026-11-15T10:00:05Z", now)).toBe("live");
    expect(gpsFreshness("2026-11-15T09:59:59Z", now)).toBe("stale");
    expect(gpsFreshness(null, now)).toBe("none");
  });

  it("parses an OSRM road route", () => {
    const r = parseOsrmRoute({
      routes: [{ duration: 600, distance: 3_456, geometry: { coordinates: [[39.84, -3.63], [39.85, -3.62]] } }],
    });
    expect(r).toEqual({ points: [{ lat: -3.63, lng: 39.84 }, { lat: -3.62, lng: 39.85 }], minutes: 10, km: 3.5 });
    expect(parseOsrmRoute({ code: "NoRoute", routes: [] })).toBeNull();
  });
});

describe("smooth marker", () => {
  it("eases from 0 to 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("rotates along the shortest arc", () => {
    expect(lerpHeading(350, 10, 0.5)).toBeCloseTo(0);
    expect(lerpHeading(10, 350, 0.5)).toBeCloseTo(0);
  });

  it("computes compass bearing", () => {
    expect(bearingDegrees(kilifi, { lat: kilifi.lat + 0.01, lng: kilifi.lng })).toBeCloseTo(0, 0);
    expect(bearingDegrees(kilifi, { lat: kilifi.lat, lng: kilifi.lng + 0.01 })).toBeCloseTo(90, 0);
  });
});
