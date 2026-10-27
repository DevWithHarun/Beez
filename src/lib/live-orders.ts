import { useEffect, useState } from "react";
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
  delivery_fee_kes: number;
  payment_status: string;
  payment_method: string;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  delivered_at: string | null;
  rider_earning_kes: number;
};

export type RiderProfile = {
  id: string;
  full_name: string;
  phone: string;
  online: boolean;
  lat: number | null;
  lng: number | null;
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
        setError(null);
        setLoaded(true);
        return;
      }

      const [riderResult, ordersResult, availableOrdersResult, payoutsResult] = await Promise.all([
        supabase
          .from("riders")
          .select("id, full_name, phone, online, lat, lng")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("*")
          .eq("rider_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("*")
          .is("rider_id", null)
          .in("status", ["Preparing", "Pending", "Ready for Pickup"])
          .order("created_at", { ascending: false }),
        supabase
          .from("rider_payout_requests")
          .select("*")
          .eq("rider_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (riderResult.error) throw new Error(riderResult.error.message);
      if (ordersResult.error) throw new Error(ordersResult.error.message);
      if (availableOrdersResult.error) throw new Error(availableOrdersResult.error.message);
      if (payoutsResult.error) throw new Error(payoutsResult.error.message);

      setRider((riderResult.data ?? null) as RiderProfile | null);
      setOrders((ordersResult.data ?? []) as DbOrder[]);
      setAvailableOrders((availableOrdersResult.data ?? []) as DbOrder[]);
      setPayouts((payoutsResult.data ?? []) as RiderPayoutRequest[]);
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
            return;
          }

          setOrders((current) => current.filter((order) => order.id !== row.id));
          if (
            row.rider_id === null &&
            ["Preparing", "Pending", "Ready for Pickup"].includes(row.status)
          ) {
            setAvailableOrders((current) => [
              row,
              ...current.filter((order) => order.id !== row.id),
            ]);
          } else {
            setAvailableOrders((current) => current.filter((order) => order.id !== row.id));
          }
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

  return { rider, orders, availableOrders, payouts, loaded, error, refresh: fetchData };
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

export async function advanceRider(orderId: string) {
  await supabase.rpc("advance_rider", { order_id: orderId });
}
