import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, PackageCheck, Phone, RefreshCw, Volume2, VolumeX, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSession } from "@/shared/auth/session";
import {
  getMerchantOrders,
  markMerchantOrderReady,
  rejectMerchantOrder,
  type MerchantOrder,
  type MerchantOrderStatus,
} from "./orders";
import {
  listQueuedReadyActions,
  markQueuedReadyConflict,
  queueReadyAction,
  QueuedReadyAction,
  removeQueuedReadyAction,
} from "./offlineReadyQueue";

type StatusFilter = "ALL" | MerchantOrderStatus;

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "All orders", value: "ALL" },
  { label: "Preparing", value: "PAID" },
  { label: "Ready", value: "READY" },
  { label: "Picked up", value: "PICKED_UP" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function MerchantOrders({ language = "en" }: { language?: "en" | "sw" }) {
  const queryClient = useQueryClient();
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [speakingOrderId, setSpeakingOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [actionMessage, setActionMessage] = useState("");
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [queuedActions, setQueuedActions] = useState<QueuedReadyAction[]>([]);
  const [offlineMessage, setOfflineMessage] = useState("");
  const replaying = useRef(false);
  const ordersQuery = useInfiniteQuery({
    queryKey: ["merchant", "orders", filter],
    queryFn: ({ pageParam }) =>
      getMerchantOrders(filter === "ALL" ? undefined : filter, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const readyMutation = useMutation({
    mutationFn: markMerchantOrderReady,
    onSuccess: async (order) => {
      setActionMessage(`${order.basketNo} is ready for pickup.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["merchant", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant", "order-summary"] }),
      ]);
    },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      rejectMerchantOrder(orderId, reason),
    onSuccess: async (order) => {
      setActionMessage(
        `${order.basketNo} was rejected. The customer refund request is pending Beez operations.`,
      );
      setRejectingOrderId(null);
      setRejectionReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["merchant", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant", "order-summary"] }),
      ]);
    },
  });

  const orders = ordersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const userId = getSession()?.user.id;

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      activeUtterance.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setQueuedActions([]);
      return;
    }
    let cancelled = false;
    const refreshQueue = async () => {
      const actions = await listQueuedReadyActions(userId);
      if (!cancelled) setQueuedActions(actions);
    };
    void refreshQueue().catch((error: unknown) => {
      if (!cancelled) {
        setOfflineMessage(
          error instanceof Error ? error.message : "Offline actions could not be loaded.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const replay = async () => {
      if (!navigator.onLine || replaying.current) return;
      replaying.current = true;
      try {
        const actions = await listQueuedReadyActions(userId);
        setQueuedActions(actions);
        for (const action of actions) {
          if (cancelled) return;
          if (action.conflict) continue;
          try {
            const result = await markMerchantOrderReady(action.orderId);
            await removeQueuedReadyAction(action);
            setActionMessage(`${result.basketNo} is ready for pickup. Saved offline and synced.`);
          } catch (error) {
            if (
              !navigator.onLine ||
              (error instanceof Error &&
                "status" in error &&
                (error.status === undefined || error.status === 0))
            ) {
              break;
            }
            const message =
              error instanceof Error
                ? error.message
                : "The order changed while this device was offline.";
            await markQueuedReadyConflict(action, message);
          }
        }
        const remaining = await listQueuedReadyActions(userId);
        if (!cancelled) {
          setQueuedActions(remaining);
          if (remaining.length === 0) {
            setOfflineMessage("");
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["merchant", "orders"] }),
              queryClient.invalidateQueries({ queryKey: ["merchant", "order-summary"] }),
              queryClient.invalidateQueries({ queryKey: ["merchant", "dashboard"] }),
            ]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setOfflineMessage(
            error instanceof Error ? error.message : "Offline actions could not be synced.",
          );
        }
      } finally {
        replaying.current = false;
      }
    };
    window.addEventListener("online", replay);
    void replay();
    return () => {
      cancelled = true;
      window.removeEventListener("online", replay);
    };
  }, [queryClient, userId]);

  function toggleReadAloud(order: MerchantOrder) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    if (speakingOrderId === order.id) {
      window.speechSynthesis.cancel();
      activeUtterance.current = null;
      setSpeakingOrderId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const itemList = order.items.map((item) => `${item.qty} ${item.name}`).join(", ");
    const text =
      language === "sw"
        ? `Agizo ${order.basketNo}. ${itemList}. Jumla ya bidhaa, shilingi ${order.subtotalKes}.`
        : `Order ${order.basketNo}. ${itemList}. Shop subtotal, ${order.subtotalKes} Kenyan shillings.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "sw" ? "sw-KE" : "en-KE";
    utterance.onend = () => {
      if (activeUtterance.current === utterance) {
        activeUtterance.current = null;
        setSpeakingOrderId(null);
      }
    };
    utterance.onerror = utterance.onend;
    activeUtterance.current = utterance;
    setSpeakingOrderId(order.id);
    window.speechSynthesis.speak(utterance);
  }

  async function queueReady(orderId: string) {
    if (!userId) {
      setOfflineMessage("Sign in again before saving offline order actions.");
      return;
    }
    try {
      await queueReadyAction(userId, orderId);
      setQueuedActions(await listQueuedReadyActions(userId));
      setOfflineMessage("");
    } catch (error) {
      setOfflineMessage(
        error instanceof Error ? error.message : "This Ready action could not be saved offline.",
      );
    }
  }

  return (
    <div className="merchant-orders">
      <header className="merchant-orders-header">
        <div>
          <span className="role-workspace-eyebrow">MERCHANT WORKSPACE</span>
          <h1>Voice Orders</h1>
          <p>Listen to new orders or review them on screen, then mark them ready for pickup.</p>
        </div>
        <button
          className="merchant-orders-refresh"
          disabled={ordersQuery.isFetching}
          type="button"
          onClick={() => void ordersQuery.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <label className="merchant-orders-filter">
        <span>Show</span>
        <select
          value={filter}
          onChange={(event) => {
            setActionMessage("");
            setFilter(event.target.value as StatusFilter);
          }}
        >
          {statusFilters.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>

      <p className="merchant-orders-live-note">
        This inbox checks for order updates every 30 seconds while it is open.
      </p>
      {actionMessage && (
        <p className="merchant-orders-success" role="status">
          {actionMessage}
        </p>
      )}
      {(offlineMessage || queuedActions.length > 0) && (
        <div className="merchant-offline-actions" role="status">
          {offlineMessage && <p>{offlineMessage}</p>}
          {queuedActions.length > 0 && (
            <p>
              {queuedActions.filter((action) => !action.conflict).length} Ready action(s) saved on
              this device; they will sync when you reconnect.
            </p>
          )}
          {queuedActions
            .filter((action) => action.conflict)
            .map((action) => (
              <p key={action.orderId}>
                An offline Ready action for order {action.orderId} needs review: {action.conflict}
                <button
                  type="button"
                  onClick={() => {
                    void removeQueuedReadyAction(action).then(async () => {
                      setQueuedActions(await listQueuedReadyActions(userId ?? ""));
                    });
                  }}
                >
                  Dismiss
                </button>
              </p>
            ))}
        </div>
      )}
      {readyMutation.isError && (
        <p className="role-workspace-error" role="alert">
          {readyMutation.error.message}
        </p>
      )}
      {rejectMutation.isError && (
        <p className="role-workspace-error" role="alert">
          {rejectMutation.error.message}
        </p>
      )}
      {ordersQuery.isPending ? (
        <p className="discover-status" role="status">
          Loading paid orders…
        </p>
      ) : ordersQuery.isError ? (
        <div className="discover-error" role="alert">
          <div>
            <strong>Your orders couldn’t be loaded</strong>
            <p>{ordersQuery.error.message}</p>
          </div>
          <button type="button" onClick={() => void ordersQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="merchant-orders-empty">
          <PackageCheck size={25} aria-hidden="true" />
          <h2>
            No{" "}
            {filter === "ALL"
              ? "paid orders"
              : statusFilters.find((s) => s.value === filter)?.label.toLowerCase()}{" "}
            yet
          </h2>
          <p>New paid orders for your shop will show here.</p>
        </div>
      ) : (
        <>
          <div className="merchant-order-list" aria-live="polite">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actionPending={readyMutation.isPending || rejectMutation.isPending}
                readyQueued={queuedActions.some((action) => action.orderId === order.id)}
                isRejecting={rejectingOrderId === order.id}
                rejectionReason={rejectionReason}
                isSpeaking={speakingOrderId === order.id}
                onReadAloud={() => toggleReadAloud(order)}
                onStartReject={() => {
                  setRejectingOrderId(order.id);
                  setRejectionReason("");
                }}
                onCancelReject={() => {
                  setRejectingOrderId(null);
                  setRejectionReason("");
                }}
                onChangeRejectReason={setRejectionReason}
                onReject={(id) => {
                  setActionMessage("");
                  rejectMutation.mutate({ orderId: id, reason: rejectionReason.trim() });
                }}
                onMarkReady={(id) => {
                  setActionMessage("");
                  if (!navigator.onLine) {
                    void queueReady(id);
                    return;
                  }
                  void readyMutation.mutateAsync(id).catch((error: unknown) => {
                    if (!navigator.onLine || isNetworkFailure(error)) {
                      readyMutation.reset();
                      void queueReady(id);
                    }
                  });
                }}
              />
            ))}
          </div>
          {ordersQuery.hasNextPage && (
            <button
              className="merchant-orders-more"
              disabled={ordersQuery.isFetchingNextPage}
              type="button"
              onClick={() => void ordersQuery.fetchNextPage()}
            >
              {ordersQuery.isFetchingNextPage ? "Loading…" : "Load older orders"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    (error.status === undefined || error.status === 0)
  );
}

function OrderCard({
  order,
  actionPending,
  readyQueued,
  isRejecting,
  rejectionReason,
  isSpeaking,
  onReadAloud,
  onStartReject,
  onCancelReject,
  onChangeRejectReason,
  onReject,
  onMarkReady,
}: {
  order: MerchantOrder;
  actionPending: boolean;
  readyQueued: boolean;
  isRejecting: boolean;
  rejectionReason: string;
  isSpeaking: boolean;
  onReadAloud: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onChangeRejectReason: (reason: string) => void;
  onReject: (id: string) => void;
  onMarkReady: (id: string) => void;
}) {
  const statusLabel: Record<MerchantOrderStatus, string> = {
    PAID: "Preparing",
    READY: "Ready for pickup",
    PICKED_UP: "Picked up",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
  };

  return (
    <article className="merchant-order-card">
      <header className="merchant-order-card-heading">
        <div>
          <span className="role-workspace-eyebrow">ORDER</span>
          <h2>{order.basketNo}</h2>
        </div>
        <span className={`merchant-order-status status-${order.status.toLowerCase()}`}>
          {statusLabel[order.status]}
        </span>
      </header>
      <p className="merchant-order-date">
        Paid{" "}
        {new Date(order.paidAt).toLocaleString("en-KE", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      {"speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" && (
        <button
          className="merchant-order-read-aloud"
          type="button"
          aria-pressed={isSpeaking}
          onClick={onReadAloud}
        >
          {isSpeaking ? (
            <VolumeX size={17} aria-hidden="true" />
          ) : (
            <Volume2 size={17} aria-hidden="true" />
          )}
          {isSpeaking ? "Stop reading" : "Read order aloud"}
        </button>
      )}
      <ul className="merchant-order-items">
        {order.items.map((item) => (
          <li key={item.productId}>
            <span>
              {item.qty} × {item.name}
            </span>
            <strong>KES {item.lineTotalKes.toLocaleString("en-KE")}</strong>
          </li>
        ))}
      </ul>
      <div className="merchant-order-total">
        <span>Shop subtotal</span>
        <strong>KES {order.subtotalKes.toLocaleString("en-KE")}</strong>
      </div>
      <div className="merchant-order-customer">
        <strong>{order.customerName}</strong>
        <a href={`tel:${order.customerPhone}`}>
          <Phone size={15} aria-hidden="true" />
          {order.customerPhone}
        </a>
        <span>
          <MapPin size={15} aria-hidden="true" />
          {order.deliveryLandmark}
        </span>
      </div>
      {order.riderName && (
        <div className="merchant-order-rider">
          <strong>Rider: {order.riderName}</strong>
          {order.riderPhone && (
            <a href={`tel:${order.riderPhone}`}>
              <Phone size={15} aria-hidden="true" />
              {order.riderPhone}
            </a>
          )}
        </div>
      )}
      {order.status === "REJECTED" && (
        <p
          className={`merchant-order-refund refund-${(order.refundStatus ?? "PENDING").toLowerCase()}`}
        >
          Refund: {order.refundStatus?.toLowerCase() ?? "pending"}
          {order.refundStatus === "PENDING" &&
            " · Beez operations must confirm the external M-Pesa refund."}
        </p>
      )}
      {order.status === "PAID" && (
        <>
          {readyQueued && (
            <p className="merchant-order-queued">Ready action queued for sync when online.</p>
          )}
          <div className="merchant-order-actions">
            <button
              className="merchant-order-ready"
              disabled={actionPending || readyQueued}
              type="button"
              onClick={() => {
                if (window.confirm(`Mark ${order.basketNo} as ready for pickup?`)) {
                  onMarkReady(order.id);
                }
              }}
            >
              <PackageCheck size={17} aria-hidden="true" />
              Mark ready for pickup
            </button>
            <button
              className="merchant-order-reject"
              disabled={actionPending}
              type="button"
              onClick={onStartReject}
              hidden={isRejecting}
            >
              <XCircle size={17} aria-hidden="true" />
              Reject order
            </button>
          </div>
          {isRejecting && (
            <form
              className="merchant-order-rejection"
              onSubmit={(event) => {
                event.preventDefault();
                if (!rejectionReason.trim()) return;
                if (window.confirm(`Reject ${order.basketNo} and request an item refund?`)) {
                  onReject(order.id);
                }
              }}
            >
              <label>
                Reason for rejection
                <textarea
                  required
                  maxLength={240}
                  minLength={1}
                  value={rejectionReason}
                  onChange={(event) => onChangeRejectReason(event.target.value)}
                />
              </label>
              <div>
                <button className="merchant-order-reject" disabled={actionPending} type="submit">
                  Reject and request refund
                </button>
                <button
                  className="merchant-orders-refresh"
                  disabled={actionPending}
                  type="button"
                  onClick={onCancelReject}
                >
                  Cancel
                </button>
              </div>
              <small>
                This requests an external refund for this shop’s items. It does not automatically
                refund the customer or cancel other shops in the basket.
              </small>
            </form>
          )}
        </>
      )}
    </article>
  );
}
