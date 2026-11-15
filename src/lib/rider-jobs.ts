// Pure rules for the rider app: job offer countdowns, the next delivery step,
// the wallet ledger, today's timeline and the shift timer. Tested.

export const OFFER_SECONDS = 45;

export type OfferLike = { id: string };

export function readyRiderOffers<T extends { status: string }>(orders: T[]) {
  return orders.filter((order) => order.status === "Ready for Pickup");
}

/** Seconds left on an offer first shown at `firstSeenMs`. Never negative. */
export function offerSecondsLeft(firstSeenMs: number, nowMs: number) {
  const left = OFFER_SECONDS - Math.floor((nowMs - firstSeenMs) / 1000);
  return Math.max(0, Math.min(OFFER_SECONDS, left));
}

/**
 * Remembers when each offer was first shown, forgetting jobs that are gone.
 * Returns a new map; ids already seen keep their original time.
 */
export function trackOfferSightings(
  seen: Record<string, number>,
  offers: OfferLike[],
  nowMs: number,
) {
  const next: Record<string, number> = {};
  for (const offer of offers) next[offer.id] = seen[offer.id] ?? nowMs;
  return next;
}

/** Offers still open for this rider: not skipped, and the 45s window not over. */
export function openOffers<T extends OfferLike>(
  offers: T[],
  seen: Record<string, number>,
  skipped: ReadonlySet<string>,
  nowMs: number,
) {
  return offers
    .filter((o) => !skipped.has(o.id))
    .map((o) => ({ offer: o, secondsLeft: offerSecondsLeft(seen[o.id] ?? nowMs, nowMs) }))
    .filter((o) => o.secondsLeft > 0);
}

/** Offers that weren't on screen before — these ring the chime. */
export function newOfferIds(previous: ReadonlySet<string>, current: OfferLike[]) {
  return current.filter((o) => !previous.has(o.id)).map((o) => o.id);
}

export type NextStep =
  | { kind: "scan"; handover: "pickup"; label: string; hint: string }
  | { kind: "scan"; handover: "dropoff"; label: string; hint: string }
  | { kind: "arriving"; label: string; hint: string }
  | { kind: "arrived"; label: string; hint: string }
  | null;

/** What the rider does next on an active delivery. */
export function riderNextStep(status: string, riderArrivedAt?: string | null): NextStep {
  if (status === "Assigned")
    return {
      kind: "scan",
      handover: "pickup",
      label: "Scan shop QR",
      hint: "Ask the shop to show their pickup QR code.",
    };
  if (status === "In Transit")
    return {
      kind: "arriving",
      label: "I'm arriving",
      hint: "Tap when you're close so the customer gets ready.",
    };
  if (status === "Out for Delivery" && !riderArrivedAt)
    return {
      kind: "arrived",
      label: "I've arrived",
      hint: "Mark arrival to alert the customer and unlock the delivery QR.",
    };
  if (status === "Out for Delivery")
    return {
      kind: "scan",
      handover: "dropoff",
      label: "Scan customer QR",
      hint: "Ask the customer to show their delivery QR code.",
    };
  return null;
}

export type Settlement = {
  order_id: string;
  rider_amount_kes: number;
  cash_collected_kes: number;
  trip_km: number | string;
  settled_at: string;
};
export type PayoutLike = {
  id: string;
  amount_kes: number;
  status: string;
  created_at: string;
  failure_reason?: string | null;
};
export type LedgerEntry = {
  id: string;
  kind: "earning" | "payout";
  label: string;
  amountKes: number; // effect on the balance: positive = in, negative = out, 0 = not sent
  displayKes: number; // the amount shown on the row
  at: string;
  status?: string;
  cashKes?: number;
  balanceKes: number; // available balance after this entry
};

/** Payout statuses that hold money (it's sent, or on its way). */
export const RESERVING_PAYOUT = ["Requested", "Processing", "Review", "Paid"];

/** Wallet ledger, newest first, with the balance after each entry. Failed payouts don't count. */
export function walletLedger(settlements: Settlement[], payouts: PayoutLike[]) {
  const items: Omit<LedgerEntry, "balanceKes">[] = [
    ...settlements.map((s) => ({
      id: `e-${s.order_id}`,
      kind: "earning" as const,
      label: `Delivery ${s.order_id}`,
      amountKes: s.rider_amount_kes,
      displayKes: s.rider_amount_kes,
      at: s.settled_at,
      cashKes: s.cash_collected_kes,
    })),
    ...payouts.map((p) => ({
      id: `p-${p.id}`,
      kind: "payout" as const,
      label: p.status === "Failed" ? "M-Pesa payout (not sent)" : "M-Pesa payout",
      amountKes: RESERVING_PAYOUT.includes(p.status) ? -p.amount_kes : 0,
      displayKes: p.amount_kes,
      at: p.created_at,
      status: p.status,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  let balance = 0;
  const withBalance = items.map((item) => {
    balance += item.amountKes;
    return { ...item, balanceKes: Math.max(0, balance) };
  });
  const earned = settlements.reduce((sum, s) => sum + s.rider_amount_kes, 0);
  const reserved = payouts
    .filter((p) => RESERVING_PAYOUT.includes(p.status))
    .reduce((sum, p) => sum + p.amount_kes, 0);
  const cash = settlements.reduce((sum, s) => sum + s.cash_collected_kes, 0);
  return {
    entries: withBalance.reverse(),
    earnedKes: earned,
    availableKes: Math.max(0, earned - reserved),
    cashCollectedKes: cash,
  };
}

/** Nairobi calendar day (YYYY-MM-DD) for a time. */
export function nairobiDay(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const EVENT_LABELS: Record<string, string> = {
  Assigned: "Accepted job",
  "In Transit": "Picked up",
  "Out for Delivery": "Arriving",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

export type TimelineItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "shift" | "status";
};

/**
 * Today's timeline (Nairobi day of `nowMs`), oldest first: shift start plus the
 * rider's status changes on their own orders.
 */
export function todayTimeline(
  orders: { id: string; merchant_name: string; customer_area: string }[],
  events: { id: string; order_id: string; status: string; created_at: string }[],
  onlineSince: string | null,
  nowMs: number,
) {
  const today = nairobiDay(nowMs);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const items: TimelineItem[] = events
    .filter(
      (e) => EVENT_LABELS[e.status] && byId.has(e.order_id) && nairobiDay(e.created_at) === today,
    )
    .map((e) => {
      const o = byId.get(e.order_id)!;
      return {
        id: e.id,
        at: e.created_at,
        title: `${EVENT_LABELS[e.status]} · ${e.order_id}`,
        detail:
          e.status === "Assigned" || e.status === "In Transit" ? o.merchant_name : o.customer_area,
        kind: "status" as const,
      };
    });
  if (onlineSince && nairobiDay(onlineSince) === today) {
    items.push({
      id: "shift",
      at: onlineSince,
      title: "Went online",
      detail: "Shift started",
      kind: "shift",
    });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/** "1h 05m" / "12m" since the shift started; null when offline. */
export function shiftDuration(onlineSince: string | null, nowMs: number) {
  if (!onlineSince) return null;
  const mins = Math.max(0, Math.floor((nowMs - new Date(onlineSince).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export const VEHICLE_TYPES = ["Motorbike", "Bicycle", "Car", "Tuk-tuk", "On foot"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Uppercase Kenyan-style plate ("KMFA 123B"); empty → null; invalid → undefined. */
export function normalizePlate(raw: string): string | null | undefined {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return null;
  if (!/^[A-Z]{2,4}[0-9]{1,4}[A-Z]?$/.test(compact)) return undefined;
  const m = compact.match(/^([A-Z]+)([0-9]+[A-Z]?)$/)!;
  return `${m[1]} ${m[2]}`;
}
