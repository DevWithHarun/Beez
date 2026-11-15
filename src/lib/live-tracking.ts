// Pure rules for live delivery tracking: GPS ping filtering, stages, ETA and
// marker easing. Shared by the rider broadcaster and the customer map; tested.

export type LatLng = { lat: number; lng: number };
export type Fix = LatLng & { at: number }; // epoch ms

export const PING_INTERVAL_MS = 4_000;
export const MAX_SPEED_MPS = 45;
export const LIVE_FRESH_MS = 30_000;
export const ROUTE_REFETCH_METERS = 150;
export const ROUTE_REFETCH_MIN_MS = 30_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(p: { lat: unknown; lng: unknown }): p is LatLng {
  return (
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** True when the jump between two fixes is faster than any rider can travel. */
export function isImpossibleJump(prev: Fix, next: Fix, maxMps = MAX_SPEED_MPS) {
  const seconds = (next.at - prev.at) / 1000;
  if (seconds <= 0) return true;
  return haversineMeters(prev, next) / seconds > maxMps;
}

/** Whether the phone should send this fix to the server (throttle + anomaly filter). */
export function shouldSendPing(lastSent: Fix | null, next: Fix, intervalMs = PING_INTERVAL_MS) {
  if (!isValidCoordinate(next)) return false;
  if (!lastSent) return true;
  if (next.at - lastSent.at < intervalMs) return false;
  return !isImpossibleJump(lastSent, next);
}

/** Compass bearing (0–360, 0 = north) from a to b. */
export function bearingDegrees(a: LatLng, b: LatLng) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Use the phone's heading when it has one, else derive it from movement (>5 m). */
export function resolveHeading(phoneHeading: number | null | undefined, prev: LatLng | null, next: LatLng) {
  if (typeof phoneHeading === "number" && Number.isFinite(phoneHeading) && phoneHeading >= 0) {
    return phoneHeading % 360;
  }
  if (prev && haversineMeters(prev, next) > 5) return bearingDegrees(prev, next);
  return null;
}

export const TRACKING_STEPS = ["Confirmed", "Preparing", "Picked up", "On the way", "Delivered"] as const;

/** Index into TRACKING_STEPS; -1 while the shop hasn't confirmed or when cancelled. */
export function trackingStep(status: string, merchantResponse?: string | null) {
  switch (status) {
    case "Pending":
      return merchantResponse === "awaiting" ? -1 : 0;
    case "Preparing":
    case "Ready for Pickup":
    case "Assigned":
      return 1;
    case "In Transit":
      return 2;
    case "Out for Delivery":
      return 3;
    case "Delivered":
      return 4;
    default:
      return -1;
  }
}

export function stageHeadline(o: {
  status: string;
  merchant_name: string;
  merchant_response?: string | null;
  riderName?: string | null;
  riderArrivedAt?: string | null;
}) {
  const shop = o.merchant_name || "The shop";
  const rider = o.riderName?.trim() || "Your rider";
  switch (o.status) {
    case "Pending":
      return o.merchant_response === "awaiting" ? `Waiting for ${shop} to confirm` : "Order confirmed";
    case "Preparing":
      return `${shop} is preparing your order`;
    case "Ready for Pickup":
      return "Packed and ready — finding a rider";
    case "Assigned":
      return `${rider} is heading to ${shop}`;
    case "In Transit":
      return `${rider} picked up your order`;
    case "Out for Delivery":
      return o.riderArrivedAt ? `${rider} has arrived` : `${rider} is on the way to you`;
    case "Delivered":
      return "Delivered — enjoy!";
    case "Cancelled":
      return "This order was cancelled";
    default:
      return o.status;
  }
}

type RouteOrder = {
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number;
  drop_lng: number;
  rider_lat: number | null;
  rider_lng: number | null;
};

/** Road route stops still ahead: rider → shop → customer before pickup, rider → customer after. */
export function routeWaypoints(o: RouteOrder): LatLng[] | null {
  const shop = { lat: o.pickup_lat, lng: o.pickup_lng };
  const home = { lat: o.drop_lat, lng: o.drop_lng };
  const rider =
    o.rider_lat != null && o.rider_lng != null ? { lat: o.rider_lat, lng: o.rider_lng } : null;
  if (o.status === "Delivered" || o.status === "Cancelled") return null;
  if (o.status === "Assigned") return rider ? [rider, shop, home] : [shop, home];
  if (o.status === "In Transit" || o.status === "Out for Delivery") return rider ? [rider, home] : [shop, home];
  return [shop, home];
}

/** Refetch the road route only after real movement, and never more than twice a minute. */
export function shouldRefetchRoute(
  last: { from: LatLng; at: number; key: string } | null,
  next: { from: LatLng; at: number; key: string },
) {
  if (!last || last.key !== next.key) return true;
  if (next.at - last.at < ROUTE_REFETCH_MIN_MS) return false;
  return haversineMeters(last.from, next.from) >= ROUTE_REFETCH_METERS;
}

/** Straight-line fallback ETA (minutes) when the road route is unavailable: 18 km/h, 1.3× detour. */
export function fallbackEtaMinutes(points: LatLng[]) {
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += haversineMeters(points[i - 1]!, points[i]!);
  return Math.max(1, Math.ceil(((meters / 1000) * 1.3 * 60) / 18));
}

/** Minutes left from a fixed arrival time; never below 1 until delivered. */
export function minutesUntil(arrivalAt: number, now: number) {
  return Math.max(1, Math.ceil((arrivalAt - now) / 60_000));
}

export type GpsFreshness = "live" | "stale" | "none";
export function gpsFreshness(locationAt: string | null | undefined, now: number): GpsFreshness {
  if (!locationAt) return "none";
  const at = Date.parse(locationAt);
  if (!Number.isFinite(at)) return "none";
  return now - at <= LIVE_FRESH_MS ? "live" : "stale";
}

export function easeInOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Rotate along the shortest arc (350° → 10° turns 20°, not 340°). */
export function lerpHeading(from: number, to: number, t: number) {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** Parse an OSRM /route response into a polyline + duration, or null. */
export function parseOsrmRoute(body: unknown): { points: LatLng[]; minutes: number; km: number } | null {
  const route = (body as { routes?: { geometry?: { coordinates?: unknown }; duration?: unknown; distance?: unknown }[] })
    ?.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  if (typeof route?.duration !== "number" || typeof route?.distance !== "number") return null;
  const points: LatLng[] = [];
  for (const c of coords) {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") points.push({ lat: c[1], lng: c[0] });
  }
  if (points.length < 2) return null;
  return {
    points,
    minutes: Math.max(1, Math.round(route.duration / 60)),
    km: Math.round(route.distance / 100) / 10,
  };
}
