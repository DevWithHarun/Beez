import { Link } from '@tanstack/react-router';
import { Bike, Check, ChevronRight, Home, MessageSquare, Package, Phone, Star, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import map from '@/assets/mombasa-map.jpg';
import riderImg from '@/assets/rider.jpg';
import { countItems, displayStatus, firstItemName, parseItemsSummary, statusClass } from '@/lib/marketplace';
import { useOrderRider } from '@/lib/shop-data';
import type { DbOrder } from '@/lib/live-orders';
import { Photo } from './shared';

export type { DbOrder } from '@/lib/live-orders';
export { statusClass };

export function itemCount(order: Pick<DbOrder, 'items_summary'>) {
  return countItems(order.items_summary);
}

export function itemsOf(order: Pick<DbOrder, 'items_summary'>) {
  return parseItemsSummary(order.items_summary);
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

export function orderEta(order: DbOrder) {
  if (order.status === 'Delivered') return order.delivered_at ? `Delivered ${timeOf(order.delivered_at)}` : 'Delivered';
  if (order.status === 'Cancelled') return 'Cancelled';
  return `Placed ${timeOf(order.created_at)}`;
}

export function OrderRow({ order }: { order: DbOrder }) {
  const name = firstItemName(order.items_summary);
  return <Link to="/order/$id" params={{ id: order.id }} className="market-order"><Photo product={{ id: order.id, name }} /><div className="min-w-0 flex-1"><h2 className="truncate">{name}</h2><p>Order #{order.id} · KES {order.total_kes.toLocaleString()}</p><p className="truncate">{order.merchant_name} · {countItems(order.items_summary)} items</p></div><div className="shrink-0 text-right"><span className={`market-status ${statusClass(order.status)}`}>{displayStatus(order.status)}</span><p>{orderEta(order)}</p></div><ChevronRight className="h-4 w-4 shrink-0" /></Link>;
}

const steps = [{ l: 'Confirmed', i: Check }, { l: 'Preparing', i: Package }, { l: 'Out for Delivery', i: Bike }, { l: 'Delivered', i: Home }];
export function stepIndexOf(status: string) {
  if (status === 'Delivered') return 3;
  if (['Out for Delivery', 'In Transit', 'Assigned'].includes(status)) return 2;
  return 1; // Pending, Preparing, Ready for Pickup, Cancelled
}
export function Progress({ order }: { order: DbOrder }) {
  const n = stepIndexOf(order.status);
  return <div className="market-progress">{steps.map((s, i) => <div key={s.l} className={i < n ? 'passed' : i === n ? 'passed current' : ''}><s.i />{s.l}<small>{i <= n ? timeOf(order.created_at) : ''}</small></div>)}</div>;
}
export function Timeline({ order }: { order: DbOrder }) {
  const n = stepIndexOf(order.status) + 1;
  const all = [
    { l: 'Order Placed', t: timeOf(order.created_at) },
    { l: order.payment_status === 'Paid' ? 'Payment Confirmed' : 'Payment Pending', t: order.payment_method },
    { l: 'Preparing Your Order', t: n > 2 ? 'Done' : '' },
    { l: 'Out for Delivery', t: n > 3 ? 'Rider on the way' : '' },
    { l: 'Delivered', t: order.delivered_at ? timeOf(order.delivered_at) : '' },
  ];
  return <ol className="market-timeline">{all.map((s, i) => <li key={s.l} className={i < n ? 'passed' : i === n ? 'current' : ''}>{i < n ? <Check /> : i === n ? <Bike /> : <Home />}<div><h2 className={i === n ? 'text-primary' : ''}>{s.l}</h2><p>{s.t}</p></div></li>)}</ol>;
}
export function MapView({ tall = false }: { tall?: boolean }) {
  return <div className="market-map" style={tall ? { height: 440 } : undefined}><img src={map} alt="Delivery route across Mombasa" width={1024} height={1024} /><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M27 30 L40 38 L52 42 L58 60 L72 72" /><circle cx="58" cy="60" r="1.5" /></svg><span className="map-label map-mombasa">Mombasa</span><span className="map-label map-kizingo">Kizingo</span><span className="map-pin map-store"><Store /></span><span className="map-pin map-bike"><Bike /></span><span className="map-pin map-home"><Home /></span></div>;
}
export function RiderCard({ order, actions = true }: { order: DbOrder; actions?: boolean }) {
  const { data: rider } = useOrderRider(order.rider_id);
  if (!order.rider_id) {
    return <div className="market-rider"><div className="flex items-center gap-3"><img src={riderImg} alt="Rider" width={44} height={44} /><div className="min-w-0 flex-1"><h2>Rider being assigned</h2><small>Order · {order.id}</small></div></div><p className="arrival">A rider will pick up your order from {order.merchant_name} soon.</p></div>;
  }
  const name = rider?.full_name || 'Your rider';
  const phone = rider?.phone || '';
  return <div className="market-rider"><div className="flex items-center gap-3"><img src={riderImg} alt={name} width={44} height={44} /><div className="min-w-0 flex-1"><h2>{name}</h2><small>Rider · {order.id}</small><small className="flex items-center gap-1"><Star className="h-3 w-3 fill-primary text-primary" />{rider?.online ? 'Online now' : 'Offline'}</small></div>{phone && <Button asChild size="icon" variant="outline" aria-label="Call rider"><a href={`tel:${phone}`}><Phone /></a></Button>}<Button size="icon" variant="outline" aria-label="Message rider"><MessageSquare /></Button></div><p className="arrival">{order.status === 'Delivered' ? 'Delivered — thanks!' : `${displayStatus(order.status)} · ${order.pickup_area} → ${order.customer_area}`}</p><p className="distance">Order {order.id} · KES {order.total_kes.toLocaleString()}</p>{actions && phone && <div className="mt-4 grid grid-cols-2 gap-3"><Button asChild className="rounded-full"><a href={`tel:${phone}`}>Call Rider</a></Button><Button variant="outline" className="rounded-full">Message</Button></div>}</div>;
}
