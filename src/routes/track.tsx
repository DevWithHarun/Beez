import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Search, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Brand, Location, Shell } from '@/components/marketplace/shared';
import { OrderRow } from '@/components/marketplace/track-parts';
import { filterOrders } from '@/lib/marketplace';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/track')({
  head: () => ({ meta: [{ title: 'Track your orders | Beez' }, { name: 'description', content: 'Real-time updates from sellers to your doorstep.' }, { property: 'og:title', content: 'Track your orders | Beez' }, { property: 'og:description', content: 'Real-time order tracking.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Track,
});
function Track() {
  const { orders, loaded } = useLiveOrders();
  const [s, setS] = useState('All'); const [q, setQ] = useState('');
  const list = filterOrders(orders, s, q);
  return <Shell active="Track"><div className="flex items-center justify-between gap-3"><Brand /><Location /></div>
    <h1 className="mt-5 text-xl font-bold">Track your orders</h1><p className="text-xs text-muted-foreground">Real-time updates from our sellers to your doorstep.</p>
    <div className="market-search mt-4"><Search /><input aria-label="Search by order number" placeholder="Search by order number..." value={q} onChange={e => setQ(e.target.value)} /><Link to="/track-number" aria-label="Track by order number"><ScanLine /></Link></div>
    <div className="market-chips">{['All', 'In Transit', 'Delivered', 'Cancelled'].map(c => <Button key={c} variant={c === s ? 'default' : 'outline'} onClick={() => setS(c)}>{c}</Button>)}</div>
    {!loaded ? <p className="py-12 text-center text-muted-foreground">Loading orders…</p>
      : list.length ? list.map(o => <OrderRow key={o.id} order={o} />) : <p className="py-12 text-center text-muted-foreground">No orders match.</p>}
  </Shell>;
}
