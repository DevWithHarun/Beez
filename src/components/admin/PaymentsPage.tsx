import { useMemo, useState } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import { exportCsv, kes, timeAgo, useTable, type AdminOrder } from "@/lib/admin-data";

const PAYMENT_FILTERS = ["all", "Paid", "Pending", "Refunded", "Unpaid"] as const;

type PaymentStatusFilter = (typeof PAYMENT_FILTERS)[number];

export function PaymentsPage() {
  const { rows, loaded, error, reload } = useTable<AdminOrder>("orders");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((order) => {
      const matchesMethod = methodFilter === "all" || order.payment_method === methodFilter;
      const matchesStatus = paymentFilter === "all" || order.payment_status === paymentFilter;
      const searchable = [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.merchant_name,
        order.payment_method,
        order.payment_status,
      ]
        .join(" ")
        .toLowerCase();
      return matchesMethod && matchesStatus && (!query || searchable.includes(query));
    });
  }, [rows, search, paymentFilter, methodFilter]);

  const paidOrders = list.filter(
    (order) => order.payment_status === "Paid" && order.status !== "Cancelled",
  );
  const revenue = paidOrders.reduce((sum, order) => sum + order.total_kes, 0);
  const pending = list.filter(
    (order) => order.payment_status !== "Paid" && order.status !== "Cancelled",
  );
  const pendingValue = pending.reduce((sum, order) => sum + order.total_kes, 0);
  const byMethod = Array.from(new Set(rows.map((order) => order.payment_method))).reduce<
    Record<string, number>
  >((acc, method) => {
    acc[method] = rows
      .filter(
        (order) =>
          order.payment_method === method &&
          order.payment_status === "Paid" &&
          order.status !== "Cancelled",
      )
      .reduce((sum, order) => sum + order.total_kes, 0);
    return acc;
  }, {});

  const exportPayments = () =>
    exportCsv(
      "payments.csv",
      list.map((order) => ({
        id: order.id,
        customer: order.customer_name || "Guest",
        phone: order.customer_phone || "—",
        merchant: order.merchant_name,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        total_kes: order.total_kes,
        delivery_fee_kes: order.delivery_fee_kes,
        service_fee_kes: order.service_fee_kes,
        created_at: order.created_at,
      })),
    );

  return (
    <div className="ad-page">
      <PageTitle
        title="Payments"
        sub={`${rows.filter((order) => order.status !== "Cancelled").length} transactions`}
        action={
          <button className="ad-btn ghost" onClick={exportPayments} disabled={!list.length}>
            Export CSV
          </button>
        }
      />

      <div className="ad-kpis">
        <div className="ad-card">
          <span className="ad-muted">Collected</span>
          <b>{kes(revenue)}</b>
        </div>
        <div className="ad-card">
          <span className="ad-muted">Pending</span>
          <b>{kes(pendingValue)}</b>
        </div>
        <div className="ad-card">
          <span className="ad-muted">Orders paid</span>
          <b>{paidOrders.length}</b>
        </div>
        <div className="ad-card">
          <span className="ad-muted">Methods</span>
          <b>{Object.keys(byMethod).length}</b>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            placeholder="Search customer, merchant, ID, payment method"
            value={search}
            aria-label="Search payments"
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter payments by status"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as PaymentStatusFilter)}
          >
            {PAYMENT_FILTERS.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>
          <select
            className="ad-input"
            aria-label="Filter payments by method"
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
          >
            <option value="all">All methods</option>
            {Array.from(new Set(rows.map((order) => order.payment_method))).map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
            Refresh
          </button>
        </div>

        {error && (
          <p className="ad-msg" role="alert">
            Could not load payments: {error}
          </p>
        )}
        {!loaded && <p className="ad-muted">Loading payments…</p>}
        {loaded && !error && list.length === 0 && (
          <p className="ad-muted">No payments match the current filters.</p>
        )}

        {list.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Merchant</th>
                <th>Method</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Fees</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>
                    {order.customer_name || "Guest"}
                    <br />
                    <span className="ad-muted">{order.customer_phone || "—"}</span>
                  </td>
                  <td>{order.merchant_name}</td>
                  <td>{order.payment_method}</td>
                  <td>{order.payment_status}</td>
                  <td>{kes(order.total_kes)}</td>
                  <td>{kes(order.delivery_fee_kes + order.service_fee_kes)}</td>
                  <td>{timeAgo(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
