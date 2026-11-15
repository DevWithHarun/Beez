import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bike, ChevronUp, MapPin, MessageSquare, Phone, Store } from "lucide-react";
import { ShopResponseNotice } from "@/components/marketplace/track-parts";
import { HandoverCodeButton } from "@/components/handover/HandoverCodeDialog";
import { canShowHandover } from "@/lib/handover";
import type { DbOrder } from "@/lib/live-orders";
import type { RiderProfile } from "@/lib/shop-data";
import {
  TRACKING_STEPS,
  stageHeadline,
  trackingStep,
  type GpsFreshness,
} from "@/lib/live-tracking";

type Props = {
  order: DbOrder;
  rider: RiderProfile | null | undefined;
  etaMinutes: number | null;
  freshness: GpsFreshness;
  lastSeen: string | null;
  connected: boolean;
};

const ACTIVE = ["Assigned", "In Transit", "Out for Delivery"];

export function LiveOrderTracker({ order, rider, etaMinutes, freshness, lastSeen, connected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<number | null>(null);
  const step = trackingStep(order.status, order.merchant_response);
  const active = ACTIVE.includes(order.status);
  const done = order.status === "Delivered" || order.status === "Cancelled";
  const riderName = rider?.full_name?.trim() || null;

  const gpsLabel = !order.rider_id
    ? connected
      ? "Live updates on"
      : "Reconnecting…"
    : freshness === "live"
      ? "Live GPS"
      : freshness === "stale"
        ? `Last seen ${lastSeen}`
        : "Waiting for rider GPS";

  return (
    <section
      className="track-sheet"
      data-expanded={expanded}
      aria-label="Delivery progress"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-sheet-handle]")) drag.current = e.clientY;
      }}
      onPointerUp={(e) => {
        if (drag.current === null) return;
        const dy = e.clientY - drag.current;
        drag.current = null;
        if (dy < -30) setExpanded(true);
        else if (dy > 30) setExpanded(false);
      }}
    >
      <button
        type="button"
        data-sheet-handle
        className="track-handle"
        aria-expanded={expanded}
        aria-label={expanded ? "Show less" : "Show more details"}
        onClick={() => setExpanded((v) => !v)}
      >
        <span />
      </button>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-snug text-foreground">
            {stageHeadline({ ...order, riderName, riderArrivedAt: order.rider_arrived_at })}
          </h1>
          {!done && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <span className="track-dot" data-live={freshness === "live" || (!order.rider_id && connected)} />
              {gpsLabel}
            </p>
          )}
        </div>
        {!done && etaMinutes !== null && (
          <span className="track-eta" aria-label={`Arriving in about ${etaMinutes} minutes`}>
            <b>{etaMinutes}</b> min
          </span>
        )}
      </header>

      <ol className="track-steps" aria-label="Order progress">
        {TRACKING_STEPS.map((label, i) => {
          const displayLabel = i === 3 && order.rider_arrived_at ? "Arrived" : label;
          return (
            <li key={label} data-state={i < step ? "done" : i === step ? "current" : "todo"}>
              <i />
              <span>{displayLabel}</span>
            </li>
          );
        })}
      </ol>

      <ShopResponseNotice order={order} />

      {order.rider_id && !done && (
        <div className="track-card mt-4 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Bike className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{riderName ?? "Your rider"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[rider?.vehicle_type, rider?.plate].filter(Boolean).join(" · ") || "Your Beez rider"}
            </p>
          </div>
          {rider?.phone && (
            <>
              <a className="track-action" href={`sms:${rider.phone}`} aria-label="Text rider">
                <MessageSquare className="h-5 w-5" />
              </a>
              <a className="track-action track-action-primary" href={`tel:${rider.phone}`} aria-label="Call rider">
                <Phone className="h-5 w-5" />
              </a>
            </>
          )}
        </div>
      )}

      {order.rider_id &&
        !done &&
        !order.rider_arrived_at &&
        ["In Transit", "Out for Delivery"].includes(order.status) && (
          <div className="track-card mt-4" role="status">
            Your delivery QR will be available when your rider marks their arrival.
          </div>
        )}

      {order.rider_arrived_at && !done && (
        <div className="track-card mt-4" role="status">
          <p className="font-semibold text-foreground">Your rider marked their arrival.</p>
          {order.payment_method === "Cash on Delivery" && order.payment_status !== "Paid" && (
            <p className="mt-1 text-sm text-muted-foreground">
              Pay KSh {order.total_kes.toLocaleString()} in cash, then show your delivery QR to
              confirm.
            </p>
          )}
        </div>
      )}

      {order.rider_id && canShowHandover("dropoff", order.status, order.rider_arrived_at) && (
        <HandoverCodeButton
          className="track-cta mt-4 w-full gap-2"
          orderId={order.id}
          kind="dropoff"
          status={order.status}
          arrivedAt={order.rider_arrived_at}
          label="Show delivery QR to your rider"
        />
      )}

      <div className={expanded ? "mt-4 space-y-4" : "mt-4 hidden space-y-4 sm:block"}>
        <ul className="track-card track-waypoints">
          <li data-done={step >= 2}>
            <Store className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="truncate font-semibold text-foreground">{order.merchant_name}</p>
              <p className="truncate text-xs text-muted-foreground">{order.pickup_area}</p>
            </div>
          </li>
          <li data-done={order.status === "Delivered"}>
            <MapPin className="h-5 w-5 text-track-live" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Drop-off</p>
              <p className="truncate font-semibold text-foreground">{order.customer_area}</p>
              {order.delivery_instructions && (
                <p className="text-xs text-muted-foreground">Landmark: {order.delivery_instructions}</p>
              )}
            </div>
          </li>
        </ul>

        <dl className="track-card grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Order</dt>
          <dd className="text-right font-semibold text-foreground">#{order.id}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-right font-semibold text-foreground">KSh {order.total_kes.toLocaleString()}</dd>
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="text-right text-foreground">
            {order.payment_method} · {order.payment_status}
          </dd>
        </dl>

        {order.status === "Delivered" && (
          <Link to="/order/$id/delivered" params={{ id: order.id }} className="track-cta">
            View delivery receipt
          </Link>
        )}
      </div>

      {!expanded && (
        <button type="button" className="track-more sm:hidden" onClick={() => setExpanded(true)}>
          <ChevronUp className="h-4 w-4" /> Pickup, drop-off and order details
        </button>
      )}
      {active && <span className="sr-only">Rider location updates every few seconds.</span>}
    </section>
  );
}
