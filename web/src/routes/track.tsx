import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getBasket } from "@/features/discover/api";
import {
  clearDeliveryCode,
  readDeliveryCode,
  readTrackingToken,
} from "@/features/discover/tracking";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [{ title: "Track your basket | Beez" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: TrackPage,
});

function TrackPage() {
  const [token, setToken] = useState<string | null>(null);
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const savedToken = readTrackingToken();
    setToken(savedToken);
    setDeliveryCode(savedToken ? readDeliveryCode(savedToken) : null);
    setLoaded(true);
  }, []);
  const basketQuery = useQuery({
    queryKey: ["guest-basket", token],
    queryFn: () => getBasket(token ?? ""),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  useEffect(() => {
    if (basketQuery.data?.status === "COMPLETED") {
      clearDeliveryCode();
      setDeliveryCode(null);
    }
  }, [basketQuery.data?.status]);

  return (
    <main className="discover-page track-page">
      <Link className="shop-back" to="/discover">
        Browse shops
      </Link>
      <span className="discover-kicker">GUEST ORDER</span>
      <h1>Track your basket</h1>
      {!loaded && (
        <p className="discover-status" role="status">
          Checking your basket…
        </p>
      )}
      {loaded && !token && (
        <div className="discover-empty">
          <h2>No basket to track on this device</h2>
          <p>
            Create a guest basket first. Your tracking capability stays in this browser session.
          </p>
          <Link className="checkout-submit track-browse-link" to="/discover">
            Browse shops
          </Link>
        </div>
      )}
      {basketQuery.isPending && token && (
        <p className="discover-status" role="status">
          Loading basket status…
        </p>
      )}
      {basketQuery.isError && (
        <div className="discover-error" role="alert">
          <div>
            <strong>We couldn’t load this basket</strong>
            <p>{basketQuery.error.message}</p>
          </div>
          <button type="button" onClick={() => void basketQuery.refetch()}>
            Try again
          </button>
        </div>
      )}
      {basketQuery.data && (
        <section className="track-basket" aria-live="polite">
          <p className={`track-status track-status-${basketQuery.data.status.toLowerCase()}`}>
            {basketQuery.data.status.replaceAll("_", " ")}
          </p>
          <h2>Basket {basketQuery.data.basketNo}</h2>
          <p>
            {basketQuery.data.status === "PENDING_PAYMENT"
              ? "Payment has not been confirmed. Your basket is not an order until Beez verifies payment."
              : basketQuery.data.status === "EXPIRED"
                ? "This unpaid basket has expired. Create a new basket to continue."
                : "Beez has updated your basket status."}
          </p>
          {deliveryCode && (
            <div className="guest-delivery-code-receipt">
              <strong>Delivery code: {deliveryCode}</strong>
              <p>Keep it private. Share it with your rider only after your order arrives.</p>
            </div>
          )}
          <div className="track-vendor-updates">
            <h3>Shop updates</h3>
            <ul>
              {basketQuery.data.vendors.map((vendor) => (
                <li key={vendor.merchantId}>
                  <span>
                    <strong>{vendor.name}</strong>
                    <small>{vendor.status.replaceAll("_", " ")}</small>
                    {vendor.refundStatus && (
                      <small className={`refund-${vendor.refundStatus.toLowerCase()}`}>
                        Refund {vendor.refundStatus.toLowerCase()}
                        {vendor.refundStatus === "PENDING" &&
                          " · awaiting Beez operations confirmation"}
                      </small>
                    )}
                  </span>
                  <strong>KES {vendor.subtotalKes.toLocaleString("en-KE")}</strong>
                </li>
              ))}
            </ul>
          </div>
          <ul className="track-lines">
            {basketQuery.data.lines.map((line) => (
              <li key={`${line.productId}-${line.merchantId}`}>
                <span>
                  {line.name} × {line.qty}
                  <small>{line.shopName}</small>
                </span>
                <strong>KES {line.lineTotalKes.toLocaleString("en-KE")}</strong>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Items</dt>
              <dd>KES {basketQuery.data.itemsTotalKes.toLocaleString("en-KE")}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>KES {basketQuery.data.deliveryFeeKes.toLocaleString("en-KE")}</dd>
            </div>
            <div className="basket-total">
              <dt>Total</dt>
              <dd>KES {basketQuery.data.totalKes.toLocaleString("en-KE")}</dd>
            </div>
          </dl>
          <p className="shop-order-note">
            Basket expires {new Date(basketQuery.data.expiresAt).toLocaleString()}.
          </p>
          <button
            className="location-button"
            type="button"
            onClick={() => void basketQuery.refetch()}
          >
            Refresh basket status
          </button>
        </section>
      )}
    </main>
  );
}
