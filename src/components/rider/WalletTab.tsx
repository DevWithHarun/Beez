// Rider wallet: balance from the payout ledger (one record per delivered order)
// minus payouts that were sent or are on their way, plus the M-Pesa withdraw form.
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, Wallet } from "lucide-react";
import type { RiderPayoutRequest, RiderSettlement } from "@/lib/live-orders";
import { walletLedger } from "@/lib/rider-jobs";
import { formatDayTime, formatKes } from "./format";

export function WalletTab({
  settlements,
  payouts,
  phone,
  onRequestPayout,
}: {
  settlements: RiderSettlement[];
  payouts: RiderPayoutRequest[];
  phone: string;
  onRequestPayout: (amountKes: number) => Promise<void>;
}) {
  const wallet = useMemo(() => walletLedger(settlements, payouts), [settlements, payouts]);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requested = Number(amount);
  const valid =
    Number.isSafeInteger(requested) &&
    requested > 0 &&
    requested <= Math.min(wallet.availableKes, 250_000);

  return (
    <div className="center">
      <section className="wallet-hero">
        <small>Available to withdraw</small>
        <strong>{formatKes(wallet.availableKes)}</strong>
        <div className="wallet-sub">
          <span>
            <Wallet size={14} /> Earned {formatKes(wallet.earnedKes)}
          </span>
          <span>
            <Banknote size={14} /> Cash collected {formatKes(wallet.cashCollectedKes)}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="secthead">
          <b>Withdraw to M-Pesa</b>
          <span>{phone || "No number yet"}</span>
        </div>
        <form
          className="wallet-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setSubmitting(true);
            try {
              await onRequestPayout(requested);
              setAmount("");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label>
            Amount (KES)
            <input
              type="number"
              min={1}
              max={Math.min(wallet.availableKes, 250_000)}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Whole shillings"
              required
            />
          </label>
          <button className="yellow" type="submit" disabled={!valid || !phone || submitting}>
            {submitting ? "Sending…" : "Withdraw"} <ArrowRight size={16} />
          </button>
        </form>
        {!phone && <p className="wallet-warn">Add your M-Pesa number in Profile first.</p>}
        <p className="wallet-fine">
          Your earning is added the moment a delivery is confirmed. Safaricom must confirm a
          withdrawal before it shows as paid.
        </p>
      </section>

      <section className="panel">
        <div className="secthead">
          <b>Ledger</b>
          <span>{wallet.entries.length} entries</span>
        </div>
        {wallet.entries.length ? (
          <ul className="ledger">
            {wallet.entries.map((e) => (
              <li
                key={e.id}
                data-kind={e.kind}
                data-muted={e.kind === "payout" && e.amountKes === 0}
              >
                <span className="ledger-icon">
                  {e.kind === "earning" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div>
                  <b>{e.label}</b>
                  <small>
                    {formatDayTime(e.at)}
                    {e.status ? ` · ${e.status}` : ""}
                    {e.cashKes ? ` · cash ${formatKes(e.cashKes)}` : ""}
                  </small>
                </div>
                <div className="ledger-amt">
                  <b>
                    {e.kind === "earning" ? "+" : e.amountKes ? "−" : ""}
                    {formatKes(e.displayKes)}
                  </b>
                  <small>Bal {formatKes(e.balanceKes)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Your earnings appear here after your first delivery.</p>
        )}
      </section>
    </div>
  );
}
