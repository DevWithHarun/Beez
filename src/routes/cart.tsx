import { createFileRoute, Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, Photo, Shell, Stepper } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { subtotal } from '@/lib/marketplace';
import { useCatalog } from '@/lib/shop-data';

export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Your Cart | Beez' }, { name: 'description', content: 'Review items before checkout.' }, { property: 'og:title', content: 'Your Cart | Beez' }, { property: 'og:description', content: 'Review your basket.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: CartPage,
});
function CartPage() {
  const { cart, change, clear, delivery } = useMarketplace();
  const catalog = useCatalog();
  const products = catalog.data ?? [];
  const items = products.filter(p => (cart[p.id] ?? 0));
  const sub = subtotal(cart, products);
  const fee = delivery ? 50 : 0;
  return <Shell><MarketHeader title="Your Cart">{items.length > 0 && <Button variant="link" onClick={clear}>Clear All</Button>}</MarketHeader>
    {catalog.isPending ? <p className="py-12 text-center text-muted-foreground">Loading your cart…</p>
      : catalog.isError ? <p role="alert" className="py-12 text-center text-destructive">Your cart could not be loaded. Please try again.</p>
      : items.length === 0 ? <Empty title="Your cart is empty"><Button asChild className="market-cta"><Link to="/groceries">Start shopping</Link></Button></Empty> : <>
      {items.map(p => <div key={p.id} className="market-line-item"><Photo product={p} /><div className="flex-1"><h2>{p.name}</h2><p>KES {p.price} / kg</p><div className="flex items-center justify-between gap-2"><Stepper value={(cart[p.id] ?? 0)} onChange={d => change(p.id, d)} /><b>KES {p.price * (cart[p.id] ?? 0)}</b></div></div><Button variant="ghost" size="icon" aria-label={`Remove ${p.name}`} onClick={() => change(p.id, -(cart[p.id] ?? 0))}><Trash2 /></Button></div>)}
      <div className="market-totals"><div><span>Subtotal</span><span>KES {sub}</span></div><div><span>Delivery Fee</span><span>KES {fee}</span></div><div><span>Total</span><span>KES {sub + fee}</span></div></div>
      <Button asChild className="market-cta"><Link to="/checkout">Proceed to Checkout</Link></Button></>}
  </Shell>;
}
