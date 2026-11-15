// Today (Nairobi day): shift time, totals from the payout ledger, and a timeline
// of the rider's own status changes.
import { useEffect, useMemo, useState } from "react";
import { Bike, Clock3, Route as RouteIcon, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DbOrder, OrderStatusEvent, RiderSettlement } from "@/lib/live-orders";
import { nairobiDay, shiftDuration, todayTimeline } from "@/lib/rider-jobs";
import { formatKes, formatKm, formatTime } from "./format";

export function TodayTab({
  orders,
  settlements,
  onlineSince,
  now,
}: {
  orders: DbOrder[];
  settlements: RiderSettlement[];
  onlineSince: string | null;
  now: number;
}) {
  const today = nairobiDay(now);
  const todays = useMemo(
    () =>
      orders.filter(
        (o) =>
          nairobiDay(o.assigned_at ?? o.created_at) === today ||
          (o.delivered_at && nairobiDay(o.delivered_at) === today),
      ),
    [orders, today],
  );
  const ids = todays.map((o) => o.id).join(",");
  const [events, setEvents] = useState<OrderStatusEvent[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ids) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("order_status_events")
      .select("id, order_id, status, created_at")
      .in("order_id", ids.split(","))
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setFailed(!!error);
        setEvents((data ?? []) as OrderStatusEvent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids, orders]);

  const settledToday = settlements.filter((s) => nairobiDay(s.settled_at) === today);
  const earned = settledToday.reduce((sum, s) => sum + s.rider_amount_kes, 0);
  const km = settledToday.reduce((sum, s) => sum + Number(s.trip_km || 0), 0);
  const timeline = todayTimeline(todays, events, onlineSince, now);
  const shift = shiftDuration(onlineSince, now);

  return (
    <div className="center">
      <div className="stats today-stats">
        <Mini icon={Clock3} label="On shift" value={shift ?? "Offline"} />
        <Mini icon={Bike} label="Delivered" value={String(settledToday.length)} />
        <Mini icon={Wallet} label="Earned" value={formatKes(earned)} />
        <Mini icon={RouteIcon} label="Trip distance" value={formatKm(km)} />
      </div>
      <section className="panel">
        <div className="secthead">
          <b>Timeline</b>
          <span>{today} · Nairobi time</span>
        </div>
        {failed && (
          <p className="empty-note">
            Some activity couldn't load. Pull down or reopen to try again.
          </p>
        )}
        {timeline.length ? (
          <ol className="tl">
            {timeline.map((item) => (
              <li key={item.id} data-kind={item.kind}>
                <time>{formatTime(item.at)}</time>
                <i />
                <div>
                  <b>{item.title}</b>
                  <small>{item.detail}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-note">Go online and accept a job — your day will show up here.</p>
        )}
      </section>
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="stat mini">
      <span className="icon">
        <Icon />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
