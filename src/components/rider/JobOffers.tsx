// Nearby job offers: each one gives the rider 45 seconds to accept or skip.
import { ArrowRight, Bike, MapPin, Store, X } from "lucide-react";
import type { DbOrder } from "@/lib/live-orders";
import { OFFER_SECONDS } from "@/lib/rider-jobs";
import { formatKes, formatKm } from "./format";

export type OfferOrder = DbOrder & {
  distance_km?: number | string | null;
  trip_km?: number | string | null;
};

export function JobOffers({
  offers,
  working,
  onAccept,
  onSkip,
}: {
  offers: { offer: OfferOrder; secondsLeft: number }[];
  working: string | null;
  onAccept: (order: OfferOrder) => void;
  onSkip: (orderId: string) => void;
}) {
  if (!offers.length) return null;
  return (
    <section className="offers" aria-label="New job offers" aria-live="polite">
      {offers.slice(0, 3).map(({ offer, secondsLeft }) => (
        <article className="offer" key={offer.id} data-urgent={secondsLeft <= 10}>
          <div className="offer-top">
            <span className="offer-tag">
              <Bike size={14} /> New job · {formatKm(Number(offer.distance_km))} away
            </span>
            <span
              className="countdown"
              style={{ "--p": `${(secondsLeft / OFFER_SECONDS) * 100}` } as React.CSSProperties}
              role="timer"
              aria-label={`${secondsLeft} seconds left to accept`}
            >
              <b>{secondsLeft}</b>
            </span>
          </div>
          <strong className="offer-pay">
            {formatKes(offer.rider_earning_kes || offer.delivery_fee_kes)}
          </strong>
          <div className="offer-route">
            <p>
              <Store size={15} />{" "}
              <span>
                <b>{offer.merchant_name}</b>
                <small>{offer.pickup_area}</small>
              </span>
            </p>
            <p>
              <MapPin size={15} />{" "}
              <span>
                <b>{offer.customer_area}</b>
                <small>
                  Trip {formatKm(Number(offer.trip_km))} ·{" "}
                  {offer.payment_method === "Cash on Delivery"
                    ? `Collect ${formatKes(offer.total_kes)} cash`
                    : "Paid"}
                </small>
              </span>
            </p>
          </div>
          <div className="offer-actions">
            <button
              className="offer-skip"
              onClick={() => onSkip(offer.id)}
              aria-label={`Skip job ${offer.id}`}
            >
              <X size={16} /> Skip
            </button>
            <button
              className="yellow"
              disabled={working === offer.id}
              onClick={() => onAccept(offer)}
            >
              {working === offer.id ? "Accepting…" : "Accept job"} <ArrowRight size={16} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
