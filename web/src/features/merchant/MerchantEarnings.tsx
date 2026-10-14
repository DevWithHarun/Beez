import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  getMerchantEarnings,
  getMerchantLedgerHistory,
  getMerchantWithdrawals,
  requestMerchantWithdrawal,
} from "./earnings";

export default function MerchantEarnings() {
  const queryClient = useQueryClient();
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalError, setWithdrawalError] = useState("");
  const [withdrawalNotice, setWithdrawalNotice] = useState("");
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const earningsQuery = useQuery({
    queryKey: ["merchant", "earnings"],
    queryFn: getMerchantEarnings,
    refetchInterval: 30_000,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["merchant", "earnings", "history"],
    queryFn: getMerchantLedgerHistory,
    retry: false,
  });
  const withdrawalsQuery = useQuery({
    queryKey: ["merchant", "earnings", "withdrawals"],
    queryFn: getMerchantWithdrawals,
    refetchInterval: 30_000,
    retry: false,
  });

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWithdrawalError("");
    setWithdrawalNotice("");
    const amountKes = Number(withdrawalAmount);
    if (!Number.isSafeInteger(amountKes) || amountKes <= 0) {
      setWithdrawalError("Enter a whole-number amount greater than zero.");
      return;
    }
    if (earningsQuery.data && amountKes > earningsQuery.data.availableKes) {
      setWithdrawalError("The amount is greater than your current available balance.");
      return;
    }
    setRequestingWithdrawal(true);
    try {
      await requestMerchantWithdrawal(amountKes);
      setWithdrawalAmount("");
      setWithdrawalNotice("Your withdrawal request has been submitted.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["merchant", "earnings"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant", "earnings", "withdrawals"] }),
      ]);
    } catch (cause) {
      setWithdrawalError(
        cause instanceof Error ? cause.message : "Your withdrawal request could not be submitted.",
      );
    } finally {
      setRequestingWithdrawal(false);
    }
  }

  return (
    <section className="merchant-earnings" aria-labelledby="merchant-earnings-title">
      <header className="merchant-orders-header">
        <div>
          <span className="role-workspace-eyebrow">MERCHANT WORKSPACE</span>
          <h1 id="merchant-earnings-title">Earnings</h1>
          <p>Ledger-backed earnings from orders the customer has received.</p>
        </div>
        <button
          className="merchant-orders-refresh"
          type="button"
          disabled={earningsQuery.isFetching || historyQuery.isFetching}
          onClick={() => {
            void earningsQuery.refetch();
            void historyQuery.refetch();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {earningsQuery.isPending ? (
        <p className="discover-status" role="status">
          Loading your ledger…
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
        <article className="merchant-earnings-balance">
          <Wallet size={20} aria-hidden="true" />
          <span>Available ledger balance</span>
          <strong>KES {earningsQuery.data.availableKes.toLocaleString("en-KE")}</strong>
          <small>
            {earningsQuery.data.deliveredOrders} delivered orders ·{" "}
            {earningsQuery.data.commissionPercent}% platform commission
          </small>
        </article>
      )}

      <div className="merchant-earnings-history">
        <h2>Request a withdrawal</h2>
        <p>
          Requests use your current available ledger balance and are paid manually to your
          registered M-Pesa number after Beez operations review.
        </p>
        <form
          className="merchant-withdrawal-form"
          onSubmit={(event) => void submitWithdrawal(event)}
        >
          <label>
            Amount in KES
            <input
              inputMode="numeric"
              min="1"
              max={earningsQuery.data?.availableKes}
              step="1"
              type="number"
              value={withdrawalAmount}
              onChange={(event) => setWithdrawalAmount(event.target.value)}
              disabled={!earningsQuery.data || requestingWithdrawal}
              required
            />
          </label>
          <button
            className="merchant-orders-refresh"
            type="submit"
            disabled={
              requestingWithdrawal ||
              !earningsQuery.data ||
              !Number.isSafeInteger(Number(withdrawalAmount)) ||
              Number(withdrawalAmount) <= 0 ||
              Number(withdrawalAmount) > (earningsQuery.data?.availableKes ?? 0)
            }
          >
            {requestingWithdrawal ? "Submitting…" : "Request withdrawal"}
          </button>
        </form>
        {withdrawalError && (
          <p className="role-workspace-error" role="alert">
            {withdrawalError}
          </p>
        )}
        {withdrawalNotice && (
          <p className="merchant-withdrawal-notice" role="status">
            {withdrawalNotice}
          </p>
        )}
        {withdrawalsQuery.isError ? (
          <p className="role-workspace-error" role="alert">
            Withdrawal history is unavailable: {withdrawalsQuery.error.message}
          </p>
        ) : withdrawalsQuery.isPending ? (
          <p className="discover-status" role="status">
            Loading withdrawal requests…
          </p>
        ) : withdrawalsQuery.data.length === 0 ? (
          <p className="merchant-orders-empty">You have no withdrawal requests.</p>
        ) : (
          <ul className="merchant-withdrawal-list">
            {withdrawalsQuery.data.map((withdrawal) => (
              <li key={withdrawal.id}>
                <span>
                  <strong>{withdrawal.status.replaceAll("_", " ")}</strong>
                  <small>
                    {withdrawal.payoutPhone} ·{" "}
                    {new Date(withdrawal.requestedAt).toLocaleDateString("en-KE", {
                      dateStyle: "medium",
                    })}
                    {withdrawal.providerReference
                      ? ` · Reference ${withdrawal.providerReference}`
                      : ""}
                    {withdrawal.resolutionNote ? ` · ${withdrawal.resolutionNote}` : ""}
                  </small>
                </span>
                <strong>KES {withdrawal.amountKes.toLocaleString("en-KE")}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="merchant-earnings-history">
        <h2>Ledger history</h2>
        {historyQuery.isPending ? (
          <p className="discover-status" role="status">
            Loading transactions…
          </p>
        ) : historyQuery.isError ? (
          <p className="role-workspace-error" role="alert">
            {historyQuery.error.message}
          </p>
        ) : historyQuery.data.length === 0 ? (
          <p className="merchant-orders-empty">Delivered-order earnings will appear here.</p>
        ) : (
          <ul>
            {historyQuery.data.map((entry, index) => (
              <li key={`${entry.createdAt}-${entry.orderNumber ?? index}`}>
                <span>
                  <strong>
                    {entry.orderNumber ? `Order ${entry.orderNumber}` : entry.description}
                  </strong>
                  <small>
                    {entry.description} ·{" "}
                    {new Date(entry.createdAt).toLocaleDateString("en-KE", {
                      dateStyle: "medium",
                    })}
                  </small>
                </span>
                <strong className={entry.type === "CREDIT" ? "ledger-credit" : "ledger-debit"}>
                  {entry.type === "CREDIT" ? "+" : "−"} KES{" "}
                  {entry.amountKes.toLocaleString("en-KE")}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="merchant-earnings-note">
        Earnings are credited after delivery confirmation, less the agreed 5% commission. Requested
        amounts are reserved until the request is paid or rejected. Requests awaiting review are
        included in the balance calculation.
      </p>
    </section>
  );
}
