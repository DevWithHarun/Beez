import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DbOrder = {
  id: string;
  merchant_name: string;
  pickup_area: string;
  customer_area: string;
  items_summary: string;
  total_kes: number;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number;
  drop_lng: number;
  rider_id: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
  rider_heading?: number | null;
  rider_location_at?: string | null;
  rider_arrived_at?: string | null;
  delivery_fee_kes: number;
  payment_status: string;
  payment_method: string;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  delivered_at: string | null;
  rider_earning_kes: number;
  merchant_response?: string | null;
  merchant_response_deadline?: string | null;
  delivery_instructions?: string | null;
};

export type OrderStatusEvent = {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
};

export function useMyOrders() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let poll: number | undefined;
    let refreshWhenVisible: (() => void) | undefined;
    let revision = 0;
    let requestVersion = 0;

    const fetchOrders = async (userId: string) => {
      const request = ++requestVersion;
      const currentRevision = revision;
      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (cancelled || request !== requestVersion || currentRevision !== revision) return;
      if (ordersError) {
        console.error("Your orders could not be loaded.", ordersError);
        setError("Your orders could not be loaded. Please try again.");
      } else {
        setOrders((data ?? []) as DbOrder[]);
        setError(null);
      }
      setLoaded(true);
    };

    const load = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        console.error("Your orders could not be loaded.", sessionError);
        setError("Your orders could not be loaded. Please try again.");
        setLoaded(true);
        return;
      }
      if (!session?.user) {
        setOrders([]);
        setError(null);
        setLoaded(true);
        return;
      }
      const userId = session.user.id;
      void fetchOrders(userId);

      channel = supabase
        .channel(`customer-orders-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` },
          (payload) => {
            revision += 1;
            setOrders((current) => {
              if (payload.eventType === "DELETE") {
                return current.filter((order) => order.id !== (payload.old as { id: string }).id);
              }
              const row = payload.new as DbOrder;
              return [row, ...current.filter((order) => order.id !== row.id)];
            });
            setError(null);
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            if (poll) window.clearInterval(poll);
            poll = undefined;
            // Reconcile changes that may have landed between the initial query and subscription.
            void fetchOrders(userId);
          } else if (!poll) {
            poll = window.setInterval(() => void fetchOrders(userId), 12_000);
          }
        });

      refreshWhenVisible = () => {
        if (document.visibilityState === "visible") void fetchOrders(userId);
      };
      document.addEventListener("visibilitychange", refreshWhenVisible);
    };

    void load();
    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
      if (refreshWhenVisible) document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loaded, error };
}

export function useLiveOrder(id: string) {
  const [order, setOrder] = useState<DbOrder | null>(null);
  const [events, setEvents] = useState<OrderStatusEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;
    let revision = 0;
    let requestVersion = 0;

    const fetchOrder = async () => {
      const request = ++requestVersion;
      const currentRevision = revision;
      const { data, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled || request !== requestVersion || currentRevision !== revision) return;
      if (orderError) {
        console.error("The order could not be refreshed.", orderError);
      } else {
        setOrder((data as DbOrder | null) ?? null);
      }

      const { data: statusEvents, error: eventsError } = await supabase
        .from("order_status_events")
        .select("id, order_id, status, created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true });
      if (cancelled || request !== requestVersion || currentRevision !== revision) return;
      if (eventsError) {
        console.error("Order status history could not be refreshed.", eventsError);
      } else {
        setEvents((statusEvents ?? []) as OrderStatusEvent[]);
      }
      setError(
        orderError
          ? "Order updates could not be loaded. Please try again."
          : eventsError
            ? "Order history could not be loaded. Please try again."
            : null,
      );
      setLoaded(true);
    };

    const startPolling = () => {
      if (!poll) poll = window.setInterval(() => void fetchOrder(), 12_000);
    };
    const channel = supabase
      .channel(`customer-order-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          revision += 1;
          if (payload.eventType === "DELETE") {
            setOrder(null);
            return;
          }
          setOrder(payload.new as DbOrder);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_status_events",
          filter: `order_id=eq.${id}`,
        },
        (payload) => {
          revision += 1;
          const event = payload.new as OrderStatusEvent;
          setEvents((current) =>
            [...current.filter((item) => item.id !== event.id), event].sort((a, b) =>
              a.created_at.localeCompare(b.created_at),
            ),
          );
        },
      )
      .subscribe((status) => {
        const isConnected = status === "SUBSCRIBED";
        setConnected(isConnected);
        if (isConnected) {
          if (poll) window.clearInterval(poll);
          poll = undefined;
          // Reconcile changes missed while the realtime channel was connecting or recovering.
          void fetchOrder();
        } else {
          startPolling();
        }
      });

    void fetchOrder();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchOrder();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [id]);

  return { order, events, loaded, connected, error };
}

export type RiderProfile = {
  id: string;
  full_name: string;
  phone: string;
  online: boolean;
  lat: number | null;
  lng: number | null;
  vehicle_type?: string | null;
  plate?: string | null;
  online_since?: string | null;
};

export type RiderSettlement = {
  order_id: string;
  rider_amount_kes: number;
  cash_collected_kes: number;
  trip_km: number;
  settled_at: string;
};

export type RiderPayoutRequest = {
  id: string;
  rider_id: string;
  amount_kes: number;
  currency: string;
  destination_phone: string;
  status: "Requested" | "Processing" | "Review" | "Paid" | "Failed";
  provider: "M-Pesa";
  provider_conversation_id: string | null;
  provider_originator_conversation_id: string | null;
  provider_transaction_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

export function useLiveOrders() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setOrders(data as DbOrder[]);
        if (!cancelled) setLoaded(true);
      });

    const channel = supabase
      .channel("live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        setOrders((current) => {
          if (payload.eventType === "DELETE")
            return current.filter((o) => o.id !== (payload.old as { id: string }).id);
          const row = payload.new as DbOrder;
          const rest = current.filter((o) => o.id !== row.id);
          return [row, ...rest];
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loaded };
}

export function useRiderDashboardHome() {
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<DbOrder[]>([]);
  const [payouts, setPayouts] = useState<RiderPayoutRequest[]>([]);
  const [settlements, setSettlements] = useState<RiderSettlement[]>([]);
  const userIdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!user) {
        setRider(null);
        setOrders([]);
        setAvailableOrders([]);
        setPayouts([]);
        setSettlements([]);
        setError(null);
        setLoaded(true);
        return;
      }

      userIdRef.current = user.id;
      const [riderResult, ordersResult, availableOrdersResult, payoutsResult, settlementsResult] =
        await Promise.all([
          supabase
            .from("riders")
            .select("id, full_name, phone, online, lat, lng, vehicle_type, plate, online_since")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("orders")
            .select("*")
            .eq("rider_id", user.id)
            .order("created_at", { ascending: false }),
          // Open jobs come from a narrow list that leaves out customer contact details.
          supabase.rpc("rider_available_orders"),
          supabase
            .from("rider_payout_requests")
            .select("*")
            .eq("rider_id", user.id)
            .order("created_at", { ascending: false }),
          // The payout ledger: one row per delivered order, written by the database.
          supabase
            .from("order_settlements")
            .select("order_id, rider_amount_kes, cash_collected_kes, trip_km, settled_at")
            .eq("rider_id", user.id)
            .order("settled_at", { ascending: false })
            .limit(500),
        ]);

      if (riderResult.error) throw new Error(riderResult.error.message);
      if (ordersResult.error) throw new Error(ordersResult.error.message);
      if (availableOrdersResult.error) throw new Error(availableOrdersResult.error.message);
      if (payoutsResult.error) throw new Error(payoutsResult.error.message);

      setRider((riderResult.data ?? null) as RiderProfile | null);
      setOrders((ordersResult.data ?? []) as DbOrder[]);
      setAvailableOrders(
        (availableOrdersResult.data ?? []).map((row) => ({
          ...row,
          customer_id: null,
        })) as DbOrder[],
      );
      setPayouts((payoutsResult.data ?? []) as RiderPayoutRequest[]);
      // An older backend without the ledger still shows the rest of the dashboard.
      setSettlements(
        settlementsResult.error
          ? []
          : (settlementsResult.data ?? []).map((row) => ({ ...row, trip_km: Number(row.trip_km) })),
      );
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The rider dashboard could not be loaded.",
      );
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Nearby jobs come only from the 3 km list, refreshed often (and on any order change).
  const refreshAvailable = async () => {
    const { data, error: availableError } = await supabase.rpc("rider_available_orders");
    if (availableError || !data) return;
    setAvailableOrders(data.map((row) => ({ ...row, customer_id: null })) as DbOrder[]);
  };
  const refreshAvailableRef = useRef(refreshAvailable);
  refreshAvailableRef.current = refreshAvailable;
  const refreshSettlementsRef = useRef(() => undefined as unknown);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshAvailableRef.current(), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      channel = supabase
        .channel(`rider-dashboard-home-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setOrders((current) => current.filter((order) => order.id !== deletedId));
            setAvailableOrders((current) => current.filter((order) => order.id !== deletedId));
            return;
          }

          const row = payload.new as DbOrder;
          if (row.rider_id === user.id) {
            setOrders((current) => [row, ...current.filter((order) => order.id !== row.id)]);
            setAvailableOrders((current) => current.filter((order) => order.id !== row.id));
            if (row.status === "Delivered") void refreshSettlementsRef.current();
            return;
          }

          setOrders((current) => current.filter((order) => order.id !== row.id));
          // Taken by someone else, or a new job: re-ask the 3 km list rather than trusting the event.
          setAvailableOrders((current) => current.filter((order) => order.id !== row.id));
          if (row.rider_id === null) void refreshAvailableRef.current();
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "riders", filter: `id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setRider(null);
              return;
            }
            setRider(payload.new as RiderProfile);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rider_payout_requests",
            filter: `rider_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setPayouts((current) =>
                current.filter((payout) => payout.id !== (payload.old as { id: string }).id),
              );
              return;
            }
            const row = payload.new as RiderPayoutRequest;
            setPayouts((current) => [row, ...current.filter((payout) => payout.id !== row.id)]);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  refreshSettlementsRef.current = async () => {
    if (!userIdRef.current) return;
    const { data } = await supabase
      .from("order_settlements")
      .select("order_id, rider_amount_kes, cash_collected_kes, trip_km, settled_at")
      .eq("rider_id", userIdRef.current)
      .order("settled_at", { ascending: false })
      .limit(500);
    if (data) setSettlements(data.map((row) => ({ ...row, trip_km: Number(row.trip_km) })));
  };

  return {
    rider,
    orders,
    availableOrders,
    payouts,
    settlements,
    loaded,
    error,
    refresh: fetchData,
    refreshAvailable,
  };
}

export async function setRiderOnline(online: boolean) {
  const { error } = await supabase.rpc("set_rider_online", { _online: online });
  if (error) throw new Error(error.message);
}

// Rider actions: claim an available order, then move it along.
export async function acceptOrder(orderId: string) {
  const { error } = await supabase.rpc("accept_order", { order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function advanceOrderStatus(orderId: string) {
  const { error } = await supabase.rpc("advance_order_status", { order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function markRiderArrived(orderId: string) {
  const { error } = await supabase.rpc("rider_mark_arrived", { _order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function advanceRider(orderId: string) {
  await supabase.rpc("advance_rider", { order_id: orderId });
}
