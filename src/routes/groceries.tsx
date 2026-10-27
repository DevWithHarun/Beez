import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, Photo, Shell } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { useCatalog } from '@/lib/shop-data';

export const Route = createFileRoute('/groceries')({
  head: () => ({ meta: [{ title: 'Groceries | Beez' }, { name: 'description', content: 'Fruits, vegetables and more from local vendors.' }, { property: 'og:title', content: 'Groceries | Beez' }, { property: 'og:description', content: 'Fresh groceries from local vendors.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Groceries,
});
function Groceries() {
  const [cat, setCat] = useState('All'); const { change } = useMarketplace();
  const catalog = useCatalog();
  const products = catalog.data ?? [];
  const list = products.filter(p => cat === 'All' || p.category === cat);
  return <Shell wide><MarketHeader title="Groceries" cart />
    <div className="market-chips">{['All', 'Fruits', 'Vegetables', 'Grains', 'Dairy'].map(c => <Button key={c} variant={c === cat ? 'default' : 'outline'} onClick={() => setCat(c)}>{c}</Button>)}</div>
    {catalog.isPending ? <p className="py-16 text-center text-muted-foreground">Loading products…</p>
      : catalog.isError ? <p role="alert" className="py-16 text-center text-destructive">Products could not be loaded right now. Please try again.</p>
      : list.length === 0 ? <p className="py-16 text-center text-muted-foreground">No {cat.toLowerCase()} available right now.</p> :
      <div className="market-grid">{list.map(p => <div key={p.id} className="market-product"><Link to="/product/$id" params={{ id: p.id }}><Photo product={p} /><h2>{p.name}</h2></Link><div className="market-product-footer"><p>KES {p.price} / kg</p><Button size="icon" aria-label={`Add ${p.name}`} onClick={() => change(p.id, 1)}><Plus /></Button></div></div>)}</div>}
  </Shell>;
}
