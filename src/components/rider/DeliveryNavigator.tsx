// The rider's active delivery: where to go now, how to get there, and the one
// thing to do next (scan the shop's QR, tap arriving, scan the customer's QR).
import { ArrowRight, Check, CloudOff, MapPin, Navigation, QrCode, Store } from "lucide-react";
import type { DbOrder } from "@/lib/live-orders";
import { riderNextStep } from "@/lib/rider-jobs";
import type { HandoverKind } from "@/lib/handover";
import { LiveMap } from "@/components/marketplace/LiveMap";
import { directionsUrl, formatKes, formatTime } from "./format";

const STEPS = [
  { status: "Assigned", label: "Accepted" },
  { status: "In Transit", label: "Picked up" },
  { status: "Out for Delivery", label: "Arriving" },
  { status: "Delivered", label: "Delivered" },
];

export function DeliveryNavigator({
  order,
  pendingScan,
  working,
  onScan,
  onArriving,
}: {
  order: DbOrder;
  pendingScan: boolean;
  working: boolean;
  onScan: (kind: HandoverKind) => void;
  onArriving: () => void;
}) {
  const next = riderNextStep(order.status);
  const toShop = order.status === "Assigned";
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const cash = order.payment_method === "Cash on Delivery" && order.payment_status !== "Paid";

  return (
    <div className="nav-wrap">
      <section className="panel nav-card">
        <div className="nav-stage">
          <small>
            Order {order.id}
            {order.assigned_at ? ` · accepted ${formatTime(order.assigned_at)}` : ""}
          </small>
          <b>{toShop ? "Go to the shop" : "Deliver to the customer"}</b>
        </div>
        <ol className="nav-steps" aria-label="Delivery progress">
          {STEPS.map((s, i) => (
            <li
              key={s.status}
              data-state={i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"}
            >
              <i>{i < stepIndex ? <Check size={11} /> : null}</i>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="nav-stop" data-focus={toShop}>
          <Store />
          <div>
            <small>Pick up from</small>
            <b>{order.merchant_name}</b>
            <p>{order.pickup_area}</p>
          </div>
          {toShop && (
            <a
              className="nav-go"
              href={directionsUrl(order.pickup_lat, order.pickup_lng)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={16} /> Navigate
            </a>
          )}
        </div>
        <div className="nav-stop" data-focus={!toShop}>
          <MapPin />
          <div>
            <small>Deliver to</small>
            <b>{order.customer_area}</b>
            <p>{order.items_summary}</p>
            {order.delivery_instructions && (
              <p className="nav-note">Note: {order.delivery_instructions}</p>
            )}
          </div>
          {!toShop && (
            <a
              className="nav-go"
              href={directionsUrl(order.drop_lat, order.drop_lng)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={16} /> Navigate
            </a>
          )}
        </div>

        {cash && (
          <p className="nav-cash">
            Collect <b>{formatKes(order.total_kes)}</b> cash from the customer.
          </p>
        )}

        {pendingScan ? (
          <p className="nav-pending" role="status">
            <CloudOff size={16} /> Scan saved on your phone — it will be sent when you have signal.
          </p>
        ) : next ? (
          <>
            <p className="nav-hint">{next.hint}</p>
            <button
              className="yellow nav-cta"
              disabled={working}
              onClick={() => (next.kind === "scan" ? onScan(next.handover) : onArriving())}
            >
              {next.kind === "scan" ? <QrCode size={18} /> : <ArrowRight size={18} />}
              {working ? "Updating…" : next.label}
            </button>
            {next.kind === "arriving" && (
              <button className="nav-secondary" onClick={() => onScan("dropoff")}>
                <QrCode size={15} /> Already there? Scan the customer's QR
              </button>
            )}
          </>
        ) : null}
      </section>
      <section className="map livemap nav-map">
        <LiveMap orders={[order]} />
      </section>
    </div>
  );
}
