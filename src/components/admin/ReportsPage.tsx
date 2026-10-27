import { useMemo, useState } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import {
  exportCsv,
  inLastDays,
  kes,
  statusCounts,
  useTable,
  type AdminOrder,
} from "@/lib/admin-data";

const REPORT_PERIODS = [7, 30, 90, 365] as const;

type MerchantSummary = {
  name: string;
  orders: number;
  paidOrders: number;
  paidRevenue: number;
};

export function ReportsPage() {
  const { rows, loaded, error, reload } = useTable<AdminOrder>("orders");
  const [days, setDays] = useState<(typeof REPORT_PERIODS)[number]>(30);

  const report = useMemo(() => {
    const orders = inLastDays(rows, days);
    const activeOrders = orders.filter((order) => order.status !== "Cancelled");
    const paidOrders = activeOrders.filter((order) => order.payment_status === "Paid");
    const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total_kes, 0);
    const pendingPayments = activeOrders.filter((order) =>
      ["Pending", "Unpaid"].includes(order.payment_status),
    );
    const pendingValue = pendingPayments.reduce((sum, order) => sum + order.total_kes, 0);
    const merchants = new Map<string, MerchantSummary>();

    for (const order of activeOrders) {
      const summary = merchants.get(order.merchant_name) ?? {
        name: order.merchant_name,
        orders: 0,
        paidOrders: 0,
        paidRevenue: 0,
      };
      summary.orders += 1;
      if (order.payment_status === "Paid") {
        summary.paidOrders += 1;
        summary.paidRevenue += order.total_kes;
      }
      merchants.set(order.merchant_name, summary);
    }

    return {
      orders,
      activeOrders,
      paidOrders,
      paidRevenue,
      pendingPayments,
      pendingValue,
      statuses: statusCounts(orders),
      merchants: [...merchants.values()].sort(
        (left, right) => right.paidRevenue - left.paidRevenue || right.orders - left.orders,
      ),
    };
  }, [rows, days]);

  const exportReport = () =>
    exportCsv(
      `beez-report-${days}-days.csv`,
      report.orders.map((order) => ({
        id: order.id,
        created_at: order.created_at,
        merchant: order.merchant_name,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        items_total_kes: order.total_kes - order.delivery_fee_kes - order.service_fee_kes,
        delivery_fee_kes: order.delivery_fee_kes,
        service_fee_kes: order.service_fee_kes,
        order_total_kes: order.total_kes,
      })),
    );

  return (
    <div className="ad-page">
      <PageTitle
        title="Reports"
        sub={`${days}-day order and payment summary`}
        action={
          <div className="ad-toolbar">
            <label>
              <span className="ad-muted">Reporting period</span>
              <select
                className="ad-input"
                aria-label="Reporting period"
                value={days}
                onChange={(event) => {
                  const period = REPORT_PERIODS.find(
                    (option) => option === Number(event.target.value),
                  );
                  if (period) setDays(period);
                }}
              >
                {REPORT_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    Last {period} days
                  </option>
                ))}
              </select>
            </label>
            <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
              Refresh
            </button>
            <button
              className="ad-btn ghost"
              onClick={exportReport}
              disabled={!report.orders.length}
            >
              Export CSV
            </button>
          </div>
        }
      />

      {error && (
        <p className="ad-msg" role="alert">
          Could not load reports: {error}
        </p>
      )}
      {!loaded && (
        <p className="ad-muted" role="status">
          Loading report data…
        </p>
      )}

      {loaded && !error && (
        <>
          <div className="ad-kpis">
            <div className="ad-card">
              <span className="ad-muted">Orders</span>
              <b>{report.orders.length}</b>
            </div>
            <div className="ad-card">
              <span className="ad-muted">Paid revenue</span>
              <b>{kes(report.paidRevenue)}</b>
            </div>
            <div className="ad-card">
              <span className="ad-muted">Paid orders</span>
              <b>{report.paidOrders.length}</b>
            </div>
            <div className="ad-card">
              <span className="ad-muted">Average paid order</span>
              <b>
                {kes(report.paidOrders.length ? report.paidRevenue / report.paidOrders.length : 0)}
              </b>
            </div>
            <div className="ad-card">
              <span className="ad-muted">Pending payment value</span>
              <b>{kes(report.pendingValue)}</b>
            </div>
          </div>

          <div className="ad-kpis">
            {Object.entries(report.statuses).map(([status, count]) => (
              <div className="ad-card" key={status}>
                <span className="ad-muted">{status}</span>
                <b>{count}</b>
              </div>
            ))}
          </div>

          {report.orders.length === 0 ? (
            <div className="ad-card">
              <p className="ad-muted">No orders were created in the selected reporting period.</p>
            </div>
          ) : (
            <div className="ad-card">
              <h2>Merchant performance</h2>
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Orders</th>
                    <th>Paid orders</th>
                    <th>Paid revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.merchants.map((merchant) => (
                    <tr key={merchant.name}>
                      <td>{merchant.name || "Unknown merchant"}</td>
                      <td>{merchant.orders}</td>
                      <td>{merchant.paidOrders}</td>
                      <td>{kes(merchant.paidRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
