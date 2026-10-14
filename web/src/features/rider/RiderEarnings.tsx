import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { getRiderEarnings, getRiderEarningsHistory, getRiderState } from "./api";

export default function RiderEarnings() {
  const stateQuery = useQuery({
    queryKey: ["rider", "status"],
    queryFn: getRiderState,
    retry: false,
  });
  const earningsQuery = useQuery({
    queryKey: ["rider", "earnings"],
    queryFn: getRiderEarnings,
    enabled: stateQuery.data?.approved === true,
    refetchInterval: 30_000,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["rider", "earnings", "history"],
    queryFn: getRiderEarningsHistory,
    enabled: stateQuery.data?.approved === true,
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <section className="rider-earnings" aria-labelledby="rider-earnings-title">
      <header className="merchant-orders-header">
        <div>
          <span className="role-workspace-eyebrow">RIDER WORKSPACE</span>
          <h1 id="rider-earnings-title">Earnings</h1>
          <p>Ledger-backed rider earnings from customer-confirmed deliveries.</p>
        </div>
        <button
          className="merchant-orders-refresh"
          type="button"
          disabled={stateQuery.isFetching || earningsQuery.isFetching || historyQuery.isFetching}
          onClick={() => {
            void stateQuery.refetch();
            void earningsQuery.refetch();
            void historyQuery.refetch();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

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
          <span>Your rider ledger will be available after Beez approves your rider account.</span>
        </div>
      ) : earningsQuery.isPending ? (
        <p className="discover-status" role="status">
          Loading your rider ledger…
        </p>
      ) : earningsQuery.isError ? (
        <div className="discover-error" role="alert">
          <div>
            <strong>Your earnings could not be loaded</strong>
            <p>{earningsQuery.error.message}</p>
          </div>
          <button type="button" onClick={() => void earningsQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <div className="rider-dashboard-stats rider-earnings-stats">
          <article className="rider-dashboard-stat">
            <div className="rider-dashboard-stat-head">
              <span>Ledger earnings balance</span>
              <Wallet size={18} aria-hidden="true" />
            </div>
            <strong>KES {earningsQuery.data.balanceKes.toLocaleString("en-KE")}</strong>
            <small>Calculated from your rider ledger entries</small>
          </article>
          <article className="rider-dashboard-stat">
            <div className="rider-dashboard-stat-head">
              <span>Completed deliveries</span>
              <TrendingUp size={18} aria-hidden="true" />
            </div>
            <strong>{earningsQuery.data.completedDeliveries.toLocaleString("en-KE")}</strong>
            <small>Confirmed with the customer delivery code</small>
          </article>
          <article className="rider-dashboard-stat">
            <div className="rider-dashboard-stat-head">
              <span>Platform share</span>
              <Wallet size={18} aria-hidden="true" />
            </div>
            <strong>{earningsQuery.data.commissionPercent}%</strong>
            <small>Deducted from the customer delivery fee</small>
          </article>
        </div>
      )}

      <section className="rider-panel rider-earnings-panel" aria-labelledby="rider-ledger-title">
        <div className="rider-panel-header">
          <div>
            <span className="role-workspace-eyebrow">LEDGER</span>
            <h2 id="rider-ledger-title">Earnings history</h2>
          </div>
        </div>
        {stateQuery.isPending ? (
          <p className="discover-status" role="status">
            Checking rider approval…
          </p>
        ) : stateQuery.isError ? null : !stateQuery.data.approved ? (
          <p className="merchant-orders-empty">
            Earnings history is available after rider approval.
          </p>
        ) : historyQuery.isPending ? (
          <p className="discover-status" role="status">
            Loading ledger entries…
          </p>
        ) : historyQuery.isError ? (
          <div className="discover-error" role="alert">
            <div>
              <strong>Earnings history could not be loaded</strong>
              <p>{historyQuery.error.message}</p>
            </div>
            <button type="button" onClick={() => void historyQuery.refetch()}>
              Try again
            </button>
          </div>
        ) : historyQuery.data.length === 0 ? (
          <p className="merchant-orders-empty">
            Verified delivery earnings will appear here after your first completed job.
          </p>
        ) : (
          <ul className="rider-payout-list">
            {historyQuery.data.map((entry, index) => (
              <li key={`${entry.createdAt}-${entry.basketNumber ?? index}`}>
                <div>
                  <strong>
                    {entry.basketNumber ? `Basket ${entry.basketNumber}` : entry.description}
                  </strong>
                  <span>
                    {entry.description} ·{" "}
                    {new Date(entry.createdAt).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="rider-payout-meta">
                  <strong className={entry.type === "CREDIT" ? "ledger-credit" : "ledger-debit"}>
                    {entry.type === "CREDIT" ? "+" : "−"}KES{" "}
                    {entry.amountKes.toLocaleString("en-KE")}
                  </strong>
                  <small>{entry.type === "CREDIT" ? "Credited" : "Debited"}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="merchant-earnings-note">
        This balance reflects ledger earnings, not a completed M-Pesa payout. Rider withdrawals are
        not available yet.
      </p>
    </section>
  );
}
