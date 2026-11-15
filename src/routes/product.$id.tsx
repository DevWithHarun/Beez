import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Truck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, Photo, Shell, Stepper } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { useCatalog } from '@/lib/shop-data';
import { customerImageLabel, type ImageOrigin } from '@/lib/photo-studio';

export const Route = createFileRoute('/product/$id')({
  head: () => ({ meta: [{ title: 'Product | Beez' }, { name: 'description', content: 'Fresh produce from local merchants on Beez.' }, { property: 'og:title', content: 'Product | Beez' }, { property: 'og:description', content: 'Fresh produce from local merchants.' }, { property: 'og:type', content: 'product' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProductPage,
});
function ProductPage() {
  const { id } = Route.useParams();
  const catalog = useCatalog();
  const product = catalog.data?.find(item => item.id === id);
  const [q, setQ] = useState(1); const { cart, change, addFromShop } = useMarketplace(); const nav = useNavigate();
  if (catalog.isPending) return <Shell wide><MarketHeader title="Product" back="/discover" cart /><p className="py-12 text-center text-muted-foreground">Loading product…</p></Shell>;
  if (catalog.isError) return <Shell wide><MarketHeader title="Product" back="/discover" cart /><p role="alert" className="py-12 text-center text-destructive">Product could not be loaded. Please try again.</p></Shell>;
  if (!product) throw notFound();
  const p = product;
  return <Shell wide><MarketHeader title="" back="/discover" cart /><div className="market-detail-layout market-detail"><Photo product={p} className="market-detail-photo" /><div>
    <h1>{p.name}</h1><p className="market-detail-price !mt-1 !text-primary">KES {p.price}</p>
    <p>{p.category}</p>{p.description && <p className="text-sm">{p.description}</p>}{p.imageUrl && customerImageLabel(p.imageOrigin as ImageOrigin | null | undefined) && <p className="text-xs text-muted-foreground">{customerImageLabel(p.imageOrigin as ImageOrigin | null | undefined)}</p>}<p className="text-sm text-muted-foreground">{p.stock > 0 ? `Available: ${p.stock}` : 'Out of stock'}</p>
    <Stepper value={q} max={Math.min(p.stock, Math.max(1, 99 - (cart[p.id] ?? 0)))} onChange={d => setQ(v => Math.max(1, Math.min(Math.min(p.stock, 99 - (cart[p.id] ?? 0)) || 1, v + d)))} />
    <Button className="market-cta" disabled={p.stock <= 0 || (cart[p.id] ?? 0) + q > 99} onClick={() => { if (p.merchantId) addFromShop({ id: p.id, price: p.price, quantity: q, merchantId: p.merchantId, merchantName: p.merchantName }, () => nav({ to: '/cart' })); else { change(p.id, q, p.price); nav({ to: '/cart' }); } }}>Add to Cart</Button>
    <p className="flex items-center gap-3"><Truck className="h-4 w-4" />Delivery available</p><p className="flex items-center gap-3 !mt-2"><ShieldCheck className="h-4 w-4" />Pay on delivery or M-Pesa</p>
  </div></div></Shell>;
}
