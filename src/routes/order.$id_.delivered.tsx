import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleCheck, Calendar, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, Photo, Shell } from '@/components/marketplace/shared';
import { itemCount } from '@/components/marketplace/track-parts';
import { orderProduct } from '@/lib/marketplace';
import { useLiveOrders } from '@/lib/live-orders';
import rider from '@/assets/rider.jpg';

export const Route = createFileRoute('/order/$id_/delivered')({
  head: () => ({ meta: [{ title: 'Delivered | Beez' }, { name: 'description', content: 'Your order was delivered.' }, { property: 'og:title', content: 'Delivered | Beez' }, { property: 'og:description', content: 'Thanks for shopping with Beez.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Delivered,
});
function Delivered() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Delivered" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!o) return <Shell active="Track"><MarketHeader title="Delivered" back="/track" /><Empty title="Order not found" /></Shell>;
  const p = orderProduct(o);
  return <Shell active="Track"><MarketHeader title="" back="/track" /><div className="market-success"><CircleCheck /><h1>{o.status === 'Delivered' ? 'Delivered!' : 'Delivery in progress'}</h1><p>{o.status === 'Delivered' ? 'Your order has been delivered successfully. Thanks for shopping with Beez!' : 'This order has not been marked delivered yet.'}</p></div>
    <div className="market-summary"><div className="flex items-center gap-3"><Photo product={p} className="h-12 w-12 rounded-md" /><div><h2>{p.name}</h2><p className="text-xs text-muted-foreground">Order #{o.id} · KES {o.total_kes} · {itemCount(o)} items</p></div></div>
      <p className="mt-4 flex items-center gap-3 text-xs"><Calendar className="h-5 w-5" />{o.delivered_at ? new Date(o.delivered_at).toLocaleString('en-KE') : 'Delivery date pending'}</p>
      <p className="mt-4 flex items-center gap-3 text-xs"><img src={rider} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />Delivered by James Mwangi</p></div>
    <Button className="market-cta"><Star />Rate your experience</Button>
    <Button asChild variant="outline" className="market-cta !mt-3"><Link to="/order/$id" params={{ id }}>View order details</Link></Button>
  </Shell>;
}
