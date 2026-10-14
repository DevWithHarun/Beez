import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, PackageCheck, Phone, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  claimDelivery,
  confirmDelivery,
  confirmShopPickup,
  getActiveDelivery,
  getAvailableDeliveries,
  getRiderState,
  setRiderAvailability,
} from "./api";

export default function RiderJobs() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const stateQuery = useQuery({
    queryKey: ["rider", "status"],
    queryFn: getRiderState,
    retry: false,
  });
  const activeQuery = useQuery({
    queryKey: ["rider", "active-delivery"],
    queryFn: getActiveDelivery,
    enabled: stateQuery.data?.approved === true,
    refetchInterval: 15_000,
    retry: false,
  });
  const availableQuery = useQuery({
    queryKey: ["rider", "available-deliveries"],
    queryFn: getAvailableDeliveries,
    enabled: stateQuery.data?.approved === true,
    refetchInterval: 20_000,
    retry: false,
  });
  const invalidateJobs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rider", "status"] }),
      queryClient.invalidateQueries({ queryKey: ["rider", "active-delivery"] }),
      queryClient.invalidateQueries({ queryKey: ["rider", "available-deliveries"] }),
    ]);
  const availabilityMutation = useMutation({
    mutationFn: setRiderAvailability,
    onSuccess: async () => {
      setMessage("Your availability was updated.");
      await invalidateJobs();
    },
  });
  const claimMutation = useMutation({
    mutationFn: claimDelivery,
    onSuccess: async () => {
      setMessage("Delivery claimed. Follow the shop pickup order below.");
      await invalidateJobs();
    },
  });
  const pickupMutation = useMutation({
    mutationFn: ({ deliveryId, orderId }: { deliveryId: string; orderId: string }) =>
      confirmShopPickup(deliveryId, orderId),
    onSuccess: async () => {
      setMessage("Shop pickup confirmed.");
      await invalidateJobs();
    },
  });
  const confirmMutation = useMutation({
    mutationFn: ({ deliveryId, deliveryCode }: { deliveryId: string; deliveryCode: string }) =>
      confirmDelivery(deliveryId, deliveryCode),
    onSuccess: async (result) => {
      setMessage(result.message);
      if (result.status === "DELIVERED") setCode("");
      await invalidateJobs();
    },
  });
  const actionError =
    availabilityMutation.error ??
    claimMutation.error ??
    pickupMutation.error ??
    confirmMutation.error;

  async function refreshAll() {
    await stateQuery.refetch();
    if (stateQuery.data?.approved) {
      await Promise.all([activeQuery.refetch(), availableQuery.refetch()]);
    }
  }

  function submitCode(event: FormEvent<HTMLFormElement>, deliveryId: string) {
    event.preventDefault();
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setMessage("Enter the customer’s six-digit delivery code.");
      return;
    }
    setMessage("");
    confirmMutation.mutate({ deliveryId, deliveryCode: normalizedCode });
  }

  return (
    <section className="rider-jobs" aria-labelledby="rider-jobs-title">
      <header className="merchant-orders-header">
        <div>
          <span className="role-workspace-eyebrow">RIDER WORKSPACE</span>
          <h1 id="rider-jobs-title">Delivery jobs</h1>
          <p>Go online to claim a ready basket, collect every shop order, and deliver it.</p>
        </div>
        <button
          className="merchant-orders-refresh"
          type="button"
          disabled={stateQuery.isFetching || activeQuery.isFetching || availableQuery.isFetching}
          onClick={() => void refreshAll()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>
      {message && (
        <p className="merchant-orders-success" role="status">
          {message}
        </p>
      )}
      {actionError && (
        <p className="role-workspace-error" role="alert">
          {actionError.message}
        </p>
      )}
      {stateQuery.isPending ? (
        <p className="discover-status" role="status">
          Checking rider approval…
        </p>
      ) : stateQuery.isError ? (
        <div className="discover-error" role="alert">
          <div>
            <strong>Rider status could not be loaded</strong>
            <p>{stateQuery.error.message}</p>
          </div>
          <button type="button" onClick={() => void stateQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : !stateQuery.data.approved ? (
        <div className="role-approval-notice" role="status">
          <strong>Pending approval</strong>
          <span>Beez operations must approve your rider account before jobs become available.</span>
        </div>
      ) : (
        <>
          <div className="rider-availability">
            <div>
              <strong>{stateQuery.data.available ? "You are online" : "You are offline"}</strong>
              <span>
                {stateQuery.data.available
                  ? "You can claim a delivery."
                  : "Go online when you are ready to accept a delivery."}
              </span>
            </div>
            <button
              type="button"
              disabled={availabilityMutation.isPending || Boolean(activeQuery.data)}
              onClick={() => {
                setMessage("");
                availabilityMutation.mutate(!stateQuery.data.available);
              }}
            >
              {availabilityMutation.isPending
                ? "Updating…"
                : stateQuery.data.available
                  ? "Go offline"
                  : "Go online"}
            </button>
          </div>
          {activeQuery.isError && (
            <p className="role-workspace-error" role="alert">
              {activeQuery.error.message}
            </p>
          )}
          {activeQuery.data ? (
            <ActiveDeliveryCard
              delivery={activeQuery.data}
              code={code}
              onCodeChange={setCode}
              onPickup={(orderId) =>
                pickupMutation.mutate({ deliveryId: activeQuery.data!.id, orderId })
              }
              pickupPending={pickupMutation.isPending}
              codePending={confirmMutation.isPending}
              onSubmitCode={(event) => submitCode(event, activeQuery.data!.id)}
            />
          ) : !activeQuery.isPending ? (
            <AvailableDeliveries
              deliveries={availableQuery.data ?? []}
              isOnline={stateQuery.data.available}
              isLoading={availableQuery.isPending}
              isError={availableQuery.isError}
              errorMessage={availableQuery.error?.message}
              claimPending={claimMutation.isPending}
              onClaim={(id) => {
                setMessage("");
                claimMutation.mutate(id);
              }}
              onRetry={() => void availableQuery.refetch()}
            />
          ) : (
            <p className="discover-status" role="status">
              Checking for an active delivery…
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AvailableDeliveries({
  deliveries,
  isOnline,
  isLoading,
  isError,
  errorMessage,
  claimPending,
  onClaim,
  onRetry,
}: {
  deliveries: Awaited<ReturnType<typeof getAvailableDeliveries>>;
  isOnline: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | undefined;
  claimPending: boolean;
  onClaim: (id: string) => void;
  onRetry: () => void;
}) {
  if (isLoading)
    return (
      <p className="discover-status" role="status">
        Loading ready deliveries…
      </p>
    );
  if (isError) {
    return (
      <div className="discover-error" role="alert">
        <div>
          <strong>Ready deliveries could not be loaded</strong>
          <p>{errorMessage}</p>
        </div>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (deliveries.length === 0) {
    return (
      <div className="merchant-orders-empty">
        <PackageCheck size={25} aria-hidden="true" />
        <h2>No deliveries available</h2>
        <p>Ready baskets will appear here while you are online.</p>
      </div>
    );
  }
  return (
    <div className="rider-delivery-list">
      {deliveries.map((delivery) => (
        <article className="rider-delivery-card" key={delivery.id}>
          <span className="role-workspace-eyebrow">{delivery.zoneName}</span>
          <h2>
            {delivery.shopCount} shop {delivery.shopCount === 1 ? "pickup" : "pickups"}
          </h2>
          <p>
            <MapPin size={16} aria-hidden="true" /> {delivery.deliveryLandmark}
          </p>
          <small>
            Ready since{" "}
            {new Date(delivery.createdAt).toLocaleString("en-KE", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </small>
          <button
            type="button"
            disabled={claimPending || !isOnline}
            onClick={() => onClaim(delivery.id)}
          >
            {claimPending ? "Claiming…" : isOnline ? "Claim delivery" : "Go online to claim"}
          </button>
        </article>
      ))}
    </div>
  );
}

function ActiveDeliveryCard({
  delivery,
  code,
  onCodeChange,
  onPickup,
  pickupPending,
  codePending,
  onSubmitCode,
}: {
  delivery: NonNullable<Awaited<ReturnType<typeof getActiveDelivery>>>;
  code: string;
  onCodeChange: (value: string) => void;
  onPickup: (id: string) => void;
  pickupPending: boolean;
  codePending: boolean;
  onSubmitCode: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const nextStop = delivery.stops.find((stop) => stop.status === "PENDING");
  const allPicked = delivery.stops.length > 0 && !nextStop;
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${delivery.deliveryLat},${delivery.deliveryLng}`;
  return (
    <article className="rider-active-delivery">
      <span className="role-workspace-eyebrow">
        ACTIVE DELIVERY · {delivery.status.replaceAll("_", " ")}
      </span>
      <h2>Shop pickups</h2>
      <ol>
        {delivery.stops.map((stop) => (
          <li
            className={stop.status === "PICKED_UP" ? "rider-stop-complete" : ""}
            key={stop.orderId}
          >
            <div>
              <strong>
                {stop.stopNumber}. {stop.shopName}
              </strong>
              {stop.shopLocation && <span>{stop.shopLocation}</span>}
              <a href={`tel:${stop.shopPhone}`}>
                <Phone size={14} aria-hidden="true" />
                {stop.shopPhone}
              </a>
            </div>
            {stop.status === "PICKED_UP" ? (
              <span className="rider-stop-status">
                <Check size={15} aria-hidden="true" /> Collected
              </span>
            ) : stop.orderId === nextStop?.orderId ? (
              <button type="button" disabled={pickupPending} onClick={() => onPickup(stop.orderId)}>
                {pickupPending ? "Saving…" : "Confirm pickup"}
              </button>
            ) : (
              <span className="rider-stop-status">Next</span>
            )}
          </li>
        ))}
      </ol>
      {allPicked && (
        <>
          <div className="rider-customer-destination">
            <h3>Customer delivery</h3>
            <strong>{delivery.customerName}</strong>
            <a href={`tel:${delivery.customerPhone}`}>
              <Phone size={15} aria-hidden="true" />
              {delivery.customerPhone}
            </a>
            <span>
              <MapPin size={15} aria-hidden="true" />
              {delivery.deliveryLandmark}
            </span>
            <a className="rider-map-link" href={mapUrl} target="_blank" rel="noreferrer">
              Open directions
            </a>
          </div>
          <form className="rider-delivery-code" onSubmit={onSubmitCode}>
            <label>
              Customer’s six-digit delivery code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </label>
            <button type="submit" disabled={codePending || code.length !== 6}>
              {codePending ? "Confirming…" : "Confirm delivery"}
            </button>
          </form>
        </>
      )}
    </article>
  );
}
