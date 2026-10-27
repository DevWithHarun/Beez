import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, Photo, Shell } from '@/components/marketplace/shared';
import { MapView, Progress, RiderCard, itemCount, statusClass } from '@/components/marketplace/track-parts';
import { orderProduct } from '@/lib/marketplace';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order/$id_/track')({
  head: () => ({ meta: [{ title: 'Track Order | Beez' }, { name: 'description', content: 'Follow your rider on the map.' }, { property: 'og:title', content: 'Track Order | Beez' }, { property: 'og:description', content: 'Live order tracking.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: TrackOrder,
});
function TrackOrder() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Track Order" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!o) return <Shell active="Track"><MarketHeader title="Track Order" back="/track" /><Empty title="Order not found" /></Shell>;
  const p = orderProduct(o);
  return <Shell active="Track" wide><MarketHeader title="Track Order" back="/track"><Button asChild variant="link"><Link to="/order/$id/progress" params={{ id }}>Progress</Link></Button></MarketHeader>
    <div className="flex items-center gap-3"><Photo product={p} className="h-16 w-16 shrink-0 rounded-md" /><div><h2 className="font-semibold">{p.name}</h2><p className="text-xs text-muted-foreground">Order #{o.id} · KES {o.total_kes} · {itemCount(o)} items</p><span className={`market-status ${statusClass(o.status)}`}>{o.status}</span></div></div>
    <Progress order={o} />
    <div className="market-track-layout"><Link to="/order/$id/live" params={{ id }} aria-label="Open live tracking"><MapView /></Link><div><RiderCard order={o} />
      <Button asChild variant="outline" className="market-cta"><Link to="/order/$id/scan" params={{ id }}>Confirm delivery</Link></Button></div></div>
  </Shell>;
}
