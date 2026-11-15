import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { kes, timeAgo } from "@/lib/admin-data";
import {
  getRefundSetup,
  recordManualRefund,
  rejectRefund,
  sendRefundByMpesa,
} from "@/lib/refunds.functions";

type Refund = {
  id: string;
  order_id: string;
  destination_phone: string | null;
  amount_kes: number;
  reason: string;
  status: string;
  method: string | null;
  mpesa_reference: string | null;
  failure_reason: string | null;
  admin_note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for approval",
  processing: "Sending by M-Pesa",
  review: "Check M-Pesa statement",
  failed: "Failed",
  refunded: "Refunded",
  rejected: "No payment received",
};
const REASON_LABEL: Record<string, string> = {
  merchant_declined: "Shop declined",
  merchant_no_response: "Shop didn't answer",
  paid_after_cancel: "Paid after cancellation",
};
const OPEN = ["pending", "processing", "review", "failed"];

export function RefundsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Refund[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [setup, setSetup] = useState<{ mpesa: boolean; sms: boolean } | null>(null);
  const send = useServerFn(sendRefundByMpesa);
  const record = useServerFn(recordManualRefund);
  const reject = useServerFn(rejectRefund);
  const checkSetup = useServerFn(getRefundSetup);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("order_refunds")
      .select(
        "id,order_id,destination_phone,amount_kes,reason,status,method,mpesa_reference,failure_reason,admin_note,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMsg(`Could not load refunds: ${error.message}`);
    else setRows((data ?? []) as Refund[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
    checkSetup().then(setSetup).catch(() => setSetup(null));
  }, [load, checkSetup]);

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      setInputs((current) => ({ ...current, [id]: "" }));
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That didn't work. Please try again.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const visible = showAll ? rows : rows.filter((r) => OPEN.includes(r.status));
  const waitingTotal = rows
    .filter((r) => OPEN.includes(r.status))
    .reduce((sum, r) => sum + r.amount_kes, 0);

  return (
    <div className="ad-card" aria-labelledby="refunds-title">
      <div className="ad-toolbar">
        <div style={{ flex: 1 }}>
          <h2 id="refunds-title" style={{ fontWeight: 700 }}>Refunds</h2>
          <p className="ad-muted">
            Paid orders a shop declined or didn't answer. {kes(waitingTotal)} waiting. Customers are texted
            when the order is cancelled and again when the refund is sent.
          </p>
        </div>
        <button className="ad-btn ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show open only" : "Show all"}
        </button>
        <button className="ad-btn ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {setup && (!setup.mpesa || !setup.sms) && (
        <p className="ad-msg">
          {!setup.mpesa && "Sending refunds by M-Pesa from here isn't set up yet — send from your M-Pesa account and record the code. "}
          {!setup.sms && "Customer text messages aren't set up yet, so they're waiting to be sent."}
        </p>
      )}
      {msg && (
        <p className="ad-msg" role="status">
          {msg}
        </p>
      )}
      {!loaded && <p className="ad-muted">Loading refunds…</p>}
      {loaded && visible.length === 0 && <p className="ad-muted">No refunds to handle.</p>}
      {visible.length > 0 && (
        <table className="ad-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Amount</th>
              <th>Send to</th>
              <th>Why</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const open = ["pending", "failed", "review"].includes(r.status);
              const value = inputs[r.id] ?? "";
              return (
                <tr key={r.id}>
                  <td>
                    #{r.order_id}
                    <br />
                    <span className="ad-muted">{timeAgo(r.created_at)}</span>
                  </td>
                  <td>{kes(r.amount_kes)}</td>
                  <td>{r.destination_phone ? `+${r.destination_phone}` : "No M-Pesa number"}</td>
                  <td>{REASON_LABEL[r.reason] ?? r.reason}</td>
                  <td>
                    {STATUS_LABEL[r.status] ?? r.status}
                    {r.mpesa_reference && <><br /><span className="ad-muted">M-Pesa {r.mpesa_reference}</span></>}
                    {r.failure_reason && <><br /><span className="ad-muted">{r.failure_reason}</span></>}
                    {r.admin_note && <><br /><span className="ad-muted">{r.admin_note}</span></>}
                  </td>
                  <td>
                    {open ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                        {r.status !== "review" && r.destination_phone && setup?.mpesa && (
                          <button
                            className="ad-btn sm"
                            disabled={busy === r.id}
                            onClick={() =>
                              void act(
                                r.id,
                                () => send({ data: { refundId: r.id } }),
                                "Refund sent to M-Pesa. It will show Refunded once Safaricom confirms.",
                              )
                            }
                          >
                            Approve & send {kes(r.amount_kes)}
                          </button>
                        )}
                        <input
                          className="ad-input"
                          style={{ height: 30 }}
                          aria-label={`M-Pesa code or note for order ${r.order_id}`}
                          placeholder="M-Pesa code, or a note"
                          value={value}
                          onChange={(e) => setInputs((c) => ({ ...c, [r.id]: e.target.value }))}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="ad-btn ghost sm"
                            disabled={busy === r.id || !value.trim()}
                            onClick={() =>
                              void act(
                                r.id,
                                () => record({ data: { refundId: r.id, reference: value } }),
                                "Refund recorded and customer notified.",
                              )
                            }
                          >
                            Record refund sent
                          </button>
                          <button
                            className="ad-btn ghost sm"
                            disabled={busy === r.id || value.trim().length < 3}
                            onClick={() =>
                              void act(
                                r.id,
                                () => reject({ data: { refundId: r.id, note: value } }),
                                "Marked as no payment received.",
                              )
                            }
                          >
                            No payment received
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="ad-muted">{r.status === "processing" ? "Waiting for Safaricom" : "Done"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
