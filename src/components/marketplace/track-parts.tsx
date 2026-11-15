import { Link } from '@tanstack/react-router';
import { Bike, Check, ChevronRight, CircleAlert, Clock, Home, Package, Phone, Star } from 'lucide-react';
import { cancellationNotice } from '@/lib/customer-messages';
import { Button } from '@/components/ui/button';
import { countItems, displayStatus, firstItemName, parseItemsSummary, statusClass } from '@/lib/marketplace';
import { useOrderRider } from '@/lib/shop-data';
import type { DbOrder, OrderStatusEvent } from '@/lib/live-orders';

export type { DbOrder } from '@/lib/live-orders';
export { statusClass };

export function itemCount(order: Pick<DbOrder, 'items_summary'>) {
  return countItems(order.items_summary);
}

export function itemsOf(order: Pick<DbOrder, 'items_summary'>) {
  return parseItemsSummary(order.items_summary);
}

const timeOf = (iso: string) => new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function orderEta(order: DbOrder) {
  if (order.status === 'Delivered') return order.delivered_at ? `Delivered ${timeOf(order.delivered_at)}` : 'Delivered';
  if (order.status === 'Cancelled') return 'Cancelled';
  return `Placed ${timeOf(order.created_at)}`;
}

export function OrderRow({ order }: { order: DbOrder }) {
  const name = firstItemName(order.items_summary);
  return <Link to="/track/$orderId" params={{ orderId: order.id }} className="market-order"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Package className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="truncate">{name}</h2><p className="truncate">#{order.id}</p><p className="truncate">KES {order.total_kes.toLocaleString()} · {countItems(order.items_summary)} {countItems(order.items_summary) === 1 ? 'item' : 'items'}</p><p className="truncate">{order.merchant_name}</p></div><div className="shrink-0 text-right"><span className={`market-status ${statusClass(order.status)}`}>{displayStatus(order.status)}</span><p>{orderEta(order)}</p></div><ChevronRight className="h-4 w-4 shrink-0" /></Link>;
}

export function Progress({ order }: { order: DbOrder }) {
  return <Timeline order={order} />;
}
export function Timeline({ order, events = [] }: { order: DbOrder; events?: OrderStatusEvent[] }) {
  const current = order.status === 'Cancelled'
    ? -1
    : order.status === 'Delivered'
      ? 4
      : ['Out for Delivery', 'In Transit'].includes(order.status)
        ? 3
        : ['Ready for Pickup', 'Assigned'].includes(order.status)
          ? 2
          : order.status === 'Pending' ? 0 : 1;
  const timeFor = (statuses: string[]) => {
    const event = events.find(item => statuses.includes(item.status));
    return event ? timeOf(event.created_at) : '';
  };
  const times = [
    timeOf(order.created_at),
    timeFor(['Preparing']) || (current === 1 ? timeOf(order.updated_at) : ''),
    timeFor(['Ready for Pickup', 'Assigned']) || (current === 2 ? timeOf(order.updated_at) : ''),
    timeFor(['Out for Delivery', 'In Transit']) || (current === 3 ? timeOf(order.updated_at) : ''),
    order.delivered_at ? timeOf(order.delivered_at) : timeFor(['Delivered']),
  ];
  const all = [
    { label: 'Placed', icon: Clock },
    { label: 'Confirmed', icon: Check },
    { label: 'Packed', icon: Package },
    { label: 'Out for delivery', icon: Bike },
    { label: 'Delivered', icon: Home },
  ];
  return <>
    {order.status === 'Cancelled' && <p role="status" className="market-error">This order was cancelled.</p>}
    <ol className="market-timeline">{all.map((step, index) => {
      const passed = current >= 0 && index < current;
      const active = index === current;
      const Icon = step.icon;
      return <li key={step.label} className={passed || active ? 'passed' + (active ? ' current' : '') : ''}>
        <Icon />
        <div><h2 className={active ? 'text-primary' : ''}>{step.label}</h2><p>{times[index] || 'Waiting for update'}</p></div>
      </li>;
    })}</ol>
  </>;
}
export function RiderCard({ order, actions = true }: { order: DbOrder; actions?: boolean }) {
  const { data: rider, isPending } = useOrderRider(order.id, order.rider_id);
  if (!order.rider_id) {
    return <div className="market-rider"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary"><Bike /></span><div className="min-w-0 flex-1"><h2>Rider not assigned</h2><small>Order · {order.id}</small></div></div><p className="arrival">Rider assignment status will update here.</p></div>;
  }
  const name = rider?.full_name || 'Assigned rider';
  const phone = rider?.phone || '';
  return <div className="market-rider"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary"><Bike /></span><div className="min-w-0 flex-1"><h2>{name}</h2><small>Rider · {order.id}</small><small className="flex items-center gap-1"><Star className="h-3 w-3 fill-primary text-primary" />{rider ? [rider.vehicle_type, rider.plate].filter(Boolean).join(' · ') || 'Your Beez rider' : isPending ? 'Loading rider details…' : 'Rider details unavailable'}</small></div>{phone && <Button asChild size="icon" variant="outline" aria-label="Call rider"><a href={`tel:${phone}`}><Phone /></a></Button>}</div><p className="arrival">{order.status === 'Delivered' ? 'Delivered — thanks!' : `${displayStatus(order.status)} · ${order.pickup_area} → ${order.customer_area}`}</p><p className="distance">Order {order.id} · KES {order.total_kes.toLocaleString()}</p>{actions && phone && <div className="mt-4"><Button asChild className="w-full rounded-full"><a href={`tel:${phone}`}>Call Rider</a></Button></div>}</div>;
}

// Shown to the customer while the shop decides, and after a decline or no answer.
export function ShopResponseNotice({ order }: { order: DbOrder }) {
  const notice = cancellationNotice(order);
  if (notice) {
    return <div role="status" className="mt-4 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><CircleAlert className="h-5 w-5 shrink-0 text-destructive" /><div><h2 className="font-bold">{notice.title}</h2><p className="mt-1 text-muted-foreground">{notice.body}</p><p className="mt-2 font-semibold">{notice.money}</p></div></div>;
  }
  if (order.merchant_response === 'awaiting' && order.status === 'Pending') {
    return <div role="status" className="mt-4 flex gap-3 rounded-xl border border-border bg-muted p-4 text-sm"><Clock className="h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-bold">Waiting for {order.merchant_name || 'the shop'} to confirm</h2><p className="mt-1 text-muted-foreground">Shops have a couple of minutes to accept. If they can't, we'll cancel and text you{order.payment_status === 'Paid' ? ', and start your refund' : ''}.</p></div></div>;
  }
  return null;
}
