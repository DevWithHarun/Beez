import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DbOrder } from "@/lib/live-orders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export type AdminOrder = DbOrder & {
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  delivery_fee_kes: number;
  service_fee_kes: number;
  rider_id: string | null;
  rider_earning_kes: number;
};
export type Merchant = {
  id: string;
  name: string;
  area: string;
  phone: string;
  category: string;
  business_type: string;
  owner_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type Product = {
  id: string;
  merchant_id: string | null;
  name: string;
  category: string;
  price_kes: number;
  stock: number;
  active: boolean;
  created_at: string;
};
export type AdminProductInput = Pick<
  Product,
  "name" | "category" | "price_kes" | "stock" | "active"
> & {
  merchant_id: string | null;
};
export type Ticket = {
  id: string;
  ticket_no: number;
  subject: string;
  customer_name: string;
  customer_phone: string;
  order_id: string | null;
  priority: string;
  status: string;
  notes: string;
  created_at: string;
};
export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["Low", "Medium", "High"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type AdminTicketInput = Pick<
  Ticket,
  "subject" | "customer_name" | "customer_phone" | "order_id" | "priority"
>;
export type Rider = {
  id: string;
  full_name: string;
  phone: string;
  online: boolean;
  lat: number | null;
  lng: number | null;
  created_at: string;
};
export type AdminCustomer = {
  customer_key: string;
  customer_name: string;
  customer_phone: string;
  area: string;
  order_count: number;
  paid_total_kes: number;
  last_order_at: string;
  total_count: number;
};
export type AdminCustomerOrder = {
  order_id: string;
  merchant_name: string;
  items_summary: string;
  total_kes: number;
  status: string;
  payment_method: string;
  payment_status: string;
  customer_area: string;
  created_at: string;
  total_count: number;
};

export async function loadAdminCustomers(
  search: string,
  minOrders: 1 | 2,
  limit: number,
  offset: number,
) {
  const { data, error } = await supabase.rpc("admin_customer_directory", {
    _search: search.trim() || null,
    _min_orders: minOrders,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function loadAdminCustomerOrders(customerKey: string, limit: number, offset: number) {
  const { data, error } = await supabase.rpc("admin_customer_order_history", {
    _customer_key: customerKey,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Loads a table (RLS applies) and keeps it fresh with realtime changes. */
export function useTable<T extends { id: string }>(
  table: string,
  orderBy = "created_at",
  realtime = true,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await db.from(table).select("*").order(orderBy, { ascending: false });
      if (error) throw new Error(error.message);
      setRows(data as T[]);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : `Could not load ${table}.`);
    } finally {
      setLoaded(true);
    }
  }, [table, orderBy]);

  useEffect(() => {
    void reload();
    if (!realtime) return;
    const channel = supabase
      .channel(`admin-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setRows((cur) => {
          if (payload.eventType === "DELETE")
            return cur.filter((r) => r.id !== (payload.old as { id: string }).id);
          const row = payload.new as T;
          const idx = cur.findIndex((r) => r.id === row.id);
          if (idx === -1) return [row, ...cur];
          const next = cur.slice();
          next[idx] = row;
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, realtime, reload]);

  return { rows, loaded, error, reload, setRows };
}

// ---------- pure helpers (tested) ----------

export const ORDER_STATUSES = [
  "Pending",
  "Preparing",
  "Ready for Pickup",
  "Assigned",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
] as const;
export const ADMIN_EDITABLE_ORDER_STATUSES = ORDER_STATUSES.filter(
  (status) => status !== "Delivered",
);
export type OrderStatus = (typeof ADMIN_EDITABLE_ORDER_STATUSES)[number];

export async function updateAdminOrderStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase.rpc("admin_update_order_status", {
    _order_id: orderId,
    _status: status,
  });
  if (error) throw new Error(error.message);
}

export async function updateAdminRiderAvailability(riderId: string, online: boolean) {
  const { error } = await supabase.rpc("admin_set_rider_online", {
    _rider_id: riderId,
    _online: online,
  });
  if (error) throw new Error(error.message);
}

export async function saveAdminProduct(productId: string | null, values: AdminProductInput) {
  const result = productId
    ? await supabase.from("products").update(values).eq("id", productId).select("id").single()
    : await supabase.from("products").insert(values).select("id").single();
  if (result.error) throw new Error(result.error.message);
}

export async function updateAdminProduct(productId: string, values: Partial<AdminProductInput>) {
  const { error } = await supabase
    .from("products")
    .update(values)
    .eq("id", productId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function deleteAdminProduct(productId: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function createAdminTicket(values: AdminTicketInput) {
  const { error } = await db
    .from("support_tickets")
    .insert({
      ...values,
      subject: values.subject.trim(),
      customer_name: values.customer_name.trim(),
      customer_phone: values.customer_phone.trim(),
      order_id: values.order_id?.trim() || null,
      status: "Open",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function updateAdminTicket(
  ticketId: string,
  values: Partial<Pick<Ticket, "status" | "notes">>,
) {
  const { error } = await db
    .from("support_tickets")
    .update(values)
    .eq("id", ticketId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user?.email) {
    throw new Error("Your signed-in admin account does not have an email address.");
  }

  const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthenticationError) throw new Error(reauthenticationError.message);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function inLastDays<T extends { created_at: string }>(
  rows: T[],
  days: number,
  now = Date.now(),
  offsetDays = 0,
) {
  const end = now - offsetDays * 86400000;
  const start = end - days * 86400000;
  return rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t > start && t <= end;
  });
}

/** Percentage change, rounded; null when there's no previous data to compare. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Revenue counts only non-cancelled orders. */
export function revenueOf(
  orders: Pick<AdminOrder, "status" | "total_kes" | "delivery_fee_kes" | "service_fee_kes">[],
) {
  let products = 0,
    delivery = 0,
    service = 0;
  for (const o of orders) {
    if (o.status === "Cancelled") continue;
    delivery += o.delivery_fee_kes ?? 0;
    service += o.service_fee_kes ?? 0;
    products += o.total_kes - (o.delivery_fee_kes ?? 0) - (o.service_fee_kes ?? 0);
  }
  return { products, delivery, service, total: products + delivery + service };
}

export function statusGroup(status: string) {
  if (status === "Delivered") return "Delivered";
  if (status === "Cancelled") return "Cancelled";
  if (status === "In Transit" || status === "Out for Delivery") return "In Transit";
  return "Pending";
}

export function statusCounts(orders: { status: string }[]) {
  const c: Record<string, number> = { Delivered: 0, "In Transit": 0, Pending: 0, Cancelled: 0 };
  for (const o of orders) c[statusGroup(o.status)] = (c[statusGroup(o.status)] ?? 0) + 1;
  return c;
}

export function ordersPerDay(orders: { created_at: string }[], days = 7, now = Date.now()) {
  const out: { d: string; v: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    const key = day.toDateString();
    out.push({
      d: day.toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
      v: orders.filter((o) => new Date(o.created_at).toDateString() === key).length,
    });
  }
  return out;
}

export function topMerchants(orders: AdminOrder[], limit = 5) {
  const m = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "Cancelled") continue;
    const e = m.get(o.merchant_name) ?? { name: o.merchant_name, orders: 0, revenue: 0 };
    e.orders += 1;
    e.revenue += o.total_kes;
    m.set(o.merchant_name, e);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export type Customer = {
  key: string;
  name: string;
  phone: string;
  area: string;
  orders: number;
  spent: number;
  last: string;
};
export function customersFromOrders(orders: AdminOrder[]): Customer[] {
  const m = new Map<string, Customer>();
  for (const o of orders) {
    const key = o.customer_phone || o.customer_name || `area:${o.customer_area}`;
    const e = m.get(key) ?? {
      key,
      name: o.customer_name || `Guest · ${o.customer_area}`,
      phone: o.customer_phone,
      area: o.customer_area,
      orders: 0,
      spent: 0,
      last: o.created_at,
    };
    e.orders += 1;
    if (o.status !== "Cancelled") e.spent += o.total_kes;
    if (o.created_at > e.last) e.last = o.created_at;
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

export function pillClass(status: string) {
  return (
    (
      {
        Delivered: "done",
        "Out for Delivery": "out",
        "In Transit": "transit",
        Preparing: "prep",
        Cancelled: "cancel",
      } as Record<string, string>
    )[status] ?? "prep"
  );
}

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
