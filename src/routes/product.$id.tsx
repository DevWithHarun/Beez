import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Truck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, Photo, Shell, Stepper } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { useCatalog } from '@/lib/shop-data';

export const Route = createFileRoute('/product/$id')({
  head: () => ({ meta: [{ title: 'Product | Beez' }, { name: 'description', content: 'Fresh produce from local merchants on Beez.' }, { property: 'og:title', content: 'Product | Beez' }, { property: 'og:description', content: 'Fresh produce from local merchants.' }, { property: 'og:type', content: 'product' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProductPage,
});
function ProductPage() {
  const { id } = Route.useParams();
  const catalog = useCatalog();
  const product = catalog.data?.find(item => item.id === id);
  const [q, setQ] = useState(1); const { change } = useMarketplace(); const nav = useNavigate();
  if (catalog.isPending) return <Shell wide><MarketHeader title="Product" back="/discover" cart /><p className="py-12 text-center text-muted-foreground">Loading product…</p></Shell>;
  if (catalog.isError) return <Shell wide><MarketHeader title="Product" back="/discover" cart /><p role="alert" className="py-12 text-center text-destructive">Product could not be loaded. Please try again.</p></Shell>;
  if (!product) throw notFound();
  const p = product;
  return <Shell wide><MarketHeader title="" back="/discover" cart /><div className="market-detail-layout market-detail"><Photo product={p} className="market-detail-photo" /><div>
    <h1>{p.name}</h1><p className="market-detail-price !mt-1 !text-primary">KES {p.price}</p>
    <p>{p.category}</p><p className="text-sm text-muted-foreground">{p.stock > 0 ? `Available: ${p.stock}` : 'Out of stock'}</p>
    <Stepper value={q} onChange={d => setQ(v => Math.max(1, Math.min(p.stock || 1, v + d)))} />
    <Button className="market-cta" disabled={p.stock <= 0} onClick={() => { change(p.id, q); nav({ to: '/cart' }); }}>Add to Cart</Button>
    <p className="flex items-center gap-3"><Truck className="h-4 w-4" />Delivery available</p><p className="flex items-center gap-3 !mt-2"><ShieldCheck className="h-4 w-4" />Pay on delivery or M-Pesa</p>
  </div></div></Shell>;
}
