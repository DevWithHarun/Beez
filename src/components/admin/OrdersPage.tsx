import { useMemo, useState } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import {
  exportCsv,
  ADMIN_EDITABLE_ORDER_STATUSES,
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

export function OrdersPage({ q = "" }: { q?: string }) {
  const { rows, loaded, error, reload } = useTable<AdminOrder>("orders");
  const [search, setSearch] = useState(q);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((order) => {
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const searchable = [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.merchant_name,
        order.items_summary,
        order.status,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [rows, search, statusFilter]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    if (status === order.status) return;
    if (status === "Cancelled" && !window.confirm(`Cancel order #${order.id}?`)) return;
    setUpdatingIds((current) => new Set(current).add(order.id));
    setActionError(null);
    setNotice(null);
    try {
      await updateAdminOrderStatus(order.id, status);
      await reload();
      setNotice(`Order #${order.id} updated to ${status}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update this order. Please try again.",
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
    }
  };

  const exportOrders = () =>
    exportCsv(
      "orders.csv",
      list.map((order) => ({
        id: order.id,
        customer: order.customer_name,
        phone: order.customer_phone,
        merchant: order.merchant_name,
        items: order.items_summary,
        total_kes: order.total_kes,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        status: order.status,
        created_at: order.created_at,
      })),
    );

  return (
    <div className="ad-page">
      <PageTitle
        title="Orders"
        sub={`${rows.length} orders`}
        action={
          <button className="ad-btn ghost" onClick={exportOrders} disabled={!list.length}>
            Export CSV
          </button>
        }
      />
      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            placeholder="Search ID, customer, phone, merchant, items"
            aria-label="Search orders"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter orders by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
            Refresh
          </button>
        </div>
        {error && (
          <p className="ad-msg" role="alert">
            Could not load orders: {error}
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
        {!loaded && (
          <p className="ad-muted" role="status">
            Loading orders…
          </p>
        )}
        {loaded && !error && list.length === 0 && (
          <p className="ad-muted">
            {rows.length ? "No orders match these filters." : "No orders yet."}
          </p>
        )}
        {list.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Merchant</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => {
                const updating = updatingIds.has(order.id);
                const isDelivered = order.status === "Delivered";
                const editableStatus = isEditableOrderStatus(order.status);
                const orderStatuses = ADMIN_EDITABLE_ORDER_STATUSES.filter(
                  (status) =>
                    status !== "Assigned" || order.rider_id !== null || order.status === "Assigned",
                );
                return (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>
                      {order.customer_name || "—"}
                      <br />
                      <span className="ad-muted">{order.customer_phone || "—"}</span>
                    </td>
                    <td>{order.merchant_name}</td>
                    <td>{order.items_summary}</td>
                    <td>{kes(order.total_kes)}</td>
                    <td>
                      {order.payment_method}
                      <br />
                      <span className="ad-muted">{order.payment_status}</span>
                    </td>
                    <td>
                      <span className={`ad-pill ${pillClass(order.status)}`}>{order.status}</span>
                      <select
                        className="ad-input"
                        aria-label={`Update status for order ${order.id}`}
                        value={isDelivered || editableStatus ? order.status : ""}
                        disabled={updating || !editableStatus || isDelivered}
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          if (isEditableOrderStatus(nextStatus))
                            void changeStatus(order, nextStatus);
                        }}
                      >
                        {isDelivered && (
                          <option value="Delivered">Delivered · customer confirmed</option>
                        )}
                        {!isDelivered && !editableStatus && (
                          <option value="">{order.status}</option>
                        )}
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {updating && (
                        <span className="ad-muted" role="status">
                          {" "}
                          Saving…
                        </span>
                      )}
                    </td>
                    <td>{timeAgo(order.created_at)}</td>
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
