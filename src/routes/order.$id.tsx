import { createFileRoute, Link } from '@tanstack/react-router';
import { MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, Photo, Shell } from '@/components/marketplace/shared';
import { itemCount, itemsOf, statusClass } from '@/components/marketplace/track-parts';
import { orderProduct } from '@/lib/marketplace';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order/$id')({
  head: ({ params }) => ({ meta: [{ title: `Order #${params.id} | Beez` }, { name: 'description', content: 'Items, totals and delivery address.' }, { property: 'og:title', content: 'Order Details | Beez' }, { property: 'og:description', content: 'Your order details.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Details,
});
function Details() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Order Details" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!o) return <Shell active="Track"><MarketHeader title="Order Details" back="/track" /><Empty title="Order not found" /></Shell>;
  const p = orderProduct(o); const sub = o.total_kes - o.delivery_fee_kes;
  return <Shell active="Track"><MarketHeader title="Order Details" back="/track" />
    <div className="market-line-item"><Photo product={p} /><div className="flex-1"><h2>{p.name}</h2><p>Order #{o.id}</p><p>KES {o.total_kes} · {itemCount(o)} items</p></div><span className={`market-status ${statusClass(o.status)}`}>{o.status}</span></div>
    <h2 className="mt-6 font-bold">Items</h2>{itemsOf(o).map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-3 border-b border-border py-3"><Photo product={{ id: `${o.id}-${index}`, name: item.name }} className="h-11 w-11 rounded-md" /><div className="flex-1 text-xs">{item.name}</div><div className="text-right text-xs">× {item.quantity}</div></div>)}
    <div className="market-totals !border-0"><div><span>Subtotal</span><span>KES {sub}</span></div><div><span>Delivery Fee</span><span>KES {o.delivery_fee_kes}</span></div><div><span>Total</span><span>KES {o.total_kes}</span></div></div>
    <h2 className="mt-4 font-bold">Delivery address</h2><p className="mt-2 flex items-start gap-2 text-xs"><MapPin className="h-4 w-4" />{o.customer_area}</p>
    {o.status === 'Delivered' ? <Button asChild variant="outline" className="market-cta"><Link to="/order/$id/delivered" params={{ id }}>View delivery receipt</Link></Button> : <><Button asChild variant="outline" className="market-cta border-primary"><Link to="/order/$id/track" params={{ id }}><Star />Track Live</Link></Button><Button asChild variant="ghost" className="market-cta !mt-2"><Link to="/order/$id/progress" params={{ id }}>View order progress</Link></Button></>}
  </Shell>;
}
