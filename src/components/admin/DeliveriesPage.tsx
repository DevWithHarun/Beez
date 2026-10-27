import { useMemo, useState } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import {
  ADMIN_EDITABLE_ORDER_STATUSES,
  exportCsv,
  kes,
  ORDER_STATUSES,
  pillClass,
  timeAgo,
  updateAdminOrderStatus,
  useTable,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin-data";

function isEditableOrderStatus(status: string): status is OrderStatus {
  return ADMIN_EDITABLE_ORDER_STATUSES.some((candidate) => candidate === status);
}

export function DeliveriesPage() {
  const { rows, loaded, error, reload } = useTable<AdminOrder>("orders");
  const { rows: riders } = useTable<{ id: string; full_name: string }>("riders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((order) => {
      const riderName = riders.find((rider) => rider.id === order.rider_id)?.full_name ?? "";
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const searchable = [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.merchant_name,
        order.customer_area,
        order.pickup_area,
        riderName,
        order.status,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [rows, riders, search, statusFilter]);

  const active = list.filter((order) => !["Delivered", "Cancelled"].includes(order.status));

  const updateStatus = async (order: AdminOrder, nextStatus: OrderStatus) => {
    if (nextStatus === order.status) return;
    setUpdatingIds((current) => new Set(current).add(order.id));
    setNotice(null);
    setActionError(null);
    try {
      await updateAdminOrderStatus(order.id, nextStatus);
      await reload();
      setNotice(`Delivery #${order.id} moved to ${nextStatus}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update the delivery status.",
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
    }
  };

  const exportDeliveries = () =>
    exportCsv(
      "deliveries.csv",
      active.map((order) => ({
        id: order.id,
        rider: riders.find((rider) => rider.id === order.rider_id)?.full_name ?? "Unassigned",
        merchant: order.merchant_name,
        customer: order.customer_name || "Guest",
        phone: order.customer_phone || "—",
        pickup: order.pickup_area,
        dropoff: order.customer_area,
        status: order.status,
        total_kes: order.total_kes,
        created_at: order.created_at,
      })),
    );

  return (
    <div className="ad-page">
      <PageTitle
        title="Deliveries"
        sub={`${active.length} live deliveries`}
        action={
          <button className="ad-btn ghost" onClick={exportDeliveries} disabled={!active.length}>
            Export CSV
          </button>
        }
      />
      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            type="search"
            placeholder="Search by order, rider, route, or customer"
            aria-label="Search deliveries"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter deliveries by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All live statuses</option>
            {ORDER_STATUSES.filter((status) => !["Delivered", "Cancelled"].includes(status)).map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
            Refresh
          </button>
        </div>
        {error && (
          <p className="ad-msg" role="alert">
            Could not load deliveries: {error}
          </p>
        )}
        {actionError && (
          <p className="ad-msg" role="alert">
            {actionError}
          </p>
        )}
        {notice && (
          <p className="ad-muted" role="status">
            {notice}
          </p>
        )}
        {!loaded && <p className="ad-muted">Loading deliveries…</p>}
        {loaded && !error && active.length === 0 && (
          <p className="ad-muted">
            {rows.length ? "No deliveries match these filters." : "No active deliveries yet."}
          </p>
        )}
        {active.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Rider</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {active.map((order) => {
                const riderName =
                  riders.find((rider) => rider.id === order.rider_id)?.full_name ?? "Unassigned";
                const updating = updatingIds.has(order.id);
                const editable = isEditableOrderStatus(order.status);
                return (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>
                      <b>{order.merchant_name}</b>
                      <br />
                      <span className="ad-muted">Pickup: {order.pickup_area}</span>
                      <br />
                      <span className="ad-muted">Drop-off: {order.customer_area}</span>
                    </td>
                    <td>{riderName}</td>
                    <td>
                      {order.customer_name || "Guest"}
                      <br />
                      <span className="ad-muted">{order.customer_phone || "—"}</span>
                    </td>
                    <td>{kes(order.total_kes)}</td>
                    <td>
                      <span className={`ad-pill ${pillClass(order.status)}`}>{order.status}</span>
                      <select
                        className="ad-input"
                        aria-label={`Update status for delivery ${order.id}`}
                        value={order.status}
                        disabled={updating || !editable}
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          if (isEditableOrderStatus(nextStatus))
                            void updateStatus(order, nextStatus);
                        }}
                      >
                        {ORDER_STATUSES.filter(
                          (status) => !["Delivered", "Cancelled"].includes(status),
                        ).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{timeAgo(order.updated_at || order.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
