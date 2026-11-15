import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LiveTrackingMap } from "@/components/tracking/LiveTrackingMap";
import { LiveOrderTracker } from "@/components/tracking/LiveOrderTracker";
import { useLiveOrder } from "@/lib/live-orders";
import { useOrderRider } from "@/lib/shop-data";
import { gpsFreshness, minutesUntil } from "@/lib/live-tracking";
import { useRoadRoute } from "@/lib/use-road-route";

export const Route = createFileRoute("/track_/$orderId")({
  head: () => ({
    meta: [
      { title: "Track Order | Beez" },
      { name: "description", content: "Watch your Beez rider move live on the map, with arrival time and rider contact." },
      { property: "og:title", content: "Track Order | Beez" },
      { property: "og:description", content: "Follow your Beez order live from the shop to your door." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackOrder,
});

const ACTIVE = ["Assigned", "In Transit", "Out for Delivery"];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function TrackOrder() {
  const { orderId } = Route.useParams();
  const { order, loaded, connected, error } = useLiveOrder(orderId);
  const { data: rider } = useOrderRider(order?.id, order?.rider_id);
  const now = useNow(10_000);
  const route = useRoadRoute(order);

  const active = !!order && ACTIVE.includes(order.status);
  const courier = useMemo(
    () =>
      active && order?.rider_lat != null && order?.rider_lng != null
        ? { lat: order.rider_lat, lng: order.rider_lng, heading: order.rider_heading ?? 0 }
        : null,
    [active, order?.rider_lat, order?.rider_lng, order?.rider_heading],
  );

  if (!loaded || !order) {
    return (
      <div className="beez-track">
        <TopBar orderId={orderId} />
        <div className="track-empty">
          {!loaded ? (
            <p>Loading your order…</p>
          ) : (
            <>
              <h1 className="text-lg font-bold text-foreground">Order not found</h1>
              <p role={error ? "alert" : undefined}>
                {error ?? "Open this link on the phone you ordered with, or check your orders."}
              </p>
              <Link to="/track" className="track-cta">
                View your orders
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const freshness = gpsFreshness(order.rider_location_at, now);
  const lastSeen = order.rider_location_at
    ? new Date(order.rider_location_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
    : null;
  const etaMinutes = route && order.status !== "Delivered" && order.status !== "Cancelled"
    ? minutesUntil(route.arrivalAt, now)
    : null;

  return (
    <div className="beez-track">
      <LiveTrackingMap
        shop={{ lat: order.pickup_lat, lng: order.pickup_lng }}
        home={{ lat: order.drop_lat, lng: order.drop_lng }}
        courier={courier}
        route={route?.points ?? null}
        fitKey={order.status}
      />
      <TopBar orderId={order.id} />
      {error && (
        <p role="alert" className="track-toast">
          {error}
        </p>
      )}
      <LiveOrderTracker
        order={order}
        rider={rider}
        etaMinutes={etaMinutes}
        freshness={freshness}
        lastSeen={lastSeen}
        connected={connected}
      />
    </div>
  );
}

function TopBar({ orderId }: { orderId: string }) {
  return (
    <div className="track-topbar">
      <Link to="/track" className="track-back" aria-label="Back to your orders">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <span className="track-chip">Order #{orderId}</span>
    </div>
  );
}
