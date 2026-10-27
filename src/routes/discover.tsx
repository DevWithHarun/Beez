import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ShoppingBasket, Smartphone, Shirt, Home, HeartPulse, LayoutGrid, Search, ShoppingCart, Bell, Truck, MapPin, ChevronRight, Check, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Brand, Location, Photo, Shell } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { subtotal } from '@/lib/marketplace';
import { useCatalog, useShopMerchants } from '@/lib/shop-data';
import type { ShopProduct } from '@/lib/marketplace';

export const Route = createFileRoute('/discover')({
  head: () => ({ meta: [{ title: 'Discover fresh local produce | Beez' }, { name: 'description', content: 'Shop fresh groceries from local Mombasa vendors, delivered.' }, { property: 'og:title', content: 'Discover | Beez' }, { property: 'og:description', content: 'Fresh groceries at great prices from trusted local merchants.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Discover,
});

const cats = [{ i: ShoppingBasket, l: 'Groceries', h: 150 }, { i: Smartphone, l: 'Electronics', h: 240 }, { i: Shirt, l: 'Fashion', h: 0 }, { i: Home, l: 'Home & Living', h: 300 }, { i: HeartPulse, l: 'Beauty & Health', h: 30 }, { i: LayoutGrid, l: 'More', h: 260 }];
function SectionHead({ title }: { title: string }) {
  return <div className="market-section-heading mt-7"><h2>{title}</h2><Link to="/groceries" className="flex items-center text-xs text-primary">See all<ChevronRight className="h-4 w-4" /></Link></div>;
}

function AddButton({ p }: { p: ShopProduct }) {
  const { cart, change } = useMarketplace(); const n = cart[p.id] ?? 0;
  return <Button variant="outline" size="sm" className="mt-2 h-8 w-full text-[11px]" disabled={p.stock <= 0} onClick={() => change(p.id, 1)}>{p.stock <= 0 ? "Out of stock" : n ? <><Check />In cart ({n})</> : <><ShoppingCart />Add to Cart</>}</Button>;
}

function Discover() {
  const { cart } = useMarketplace();
  const catalog = useCatalog();
  const merchantCatalog = useShopMerchants();
  const products = catalog.data ?? [];
  const merchants = merchantCatalog.data ?? [];
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  return <Shell wide>
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div className="flex min-w-0 items-center gap-3"><Brand /><div className="hidden sm:block"><Location /></div></div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Cart, ${count} items`}><Link to="/cart"><ShoppingCart />{count > 0 && <span className="market-count">{count}</span>}</Link></Button>
        <Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button>
        <Button asChild variant="outline" size="sm" className="h-9"><Link to="/track"><Truck />Track</Link></Button>
      </div>
    </header>
    <div className="mt-2 sm:hidden"><Location /></div>
    {count > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Cart total: <span className="font-semibold text-foreground">KES {subtotal(cart, products).toLocaleString()}</span></p>}

    <Link to="/groceries" className="market-search mt-3 !rounded-full"><Search /><span className="truncate text-xs text-muted-foreground">Search for products, merchants or categories...</span></Link>

    <section className="market-banner">{products[0] ? <Photo product={products[0]} /> : <div className="market-banner-placeholder" aria-hidden="true" />}<div className="market-banner-content"><h1>Fresh Groceries at Great Prices</h1><p>Quality products from trusted local merchants.</p><Button asChild className="rounded-full"><Link to="/groceries">Shop Now <ArrowRight /></Link></Button></div></section>
    <div className="mt-2 flex justify-center gap-1.5" aria-hidden><span className="h-1.5 w-5 rounded-full bg-primary" /><span className="h-1.5 w-2 rounded-full bg-border" /><span className="h-1.5 w-2 rounded-full bg-border" /></div>

    <div className="market-tiles mt-5">{cats.map(c => <Link key={c.l} to="/groceries" className="market-tile" style={{ '--tile-h': c.h } as React.CSSProperties}><c.i /><span>{c.l}</span></Link>)}</div>

    <SectionHead title="Featured Merchants" />
    {merchantCatalog.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Loading merchants…</p>}
    {merchantCatalog.isError && <p role="alert" className="py-6 text-center text-sm text-destructive">Merchants could not be loaded right now. Please try again.</p>}
    {!merchantCatalog.isPending && !merchantCatalog.isError && merchants.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No active merchants yet.</p>}
    {merchants.length > 0 && <div className="market-hscroll">{merchants.map(m => <Link key={m.id} to="/groceries" className="market-merchant">{m.image_url ? <img src={m.image_url} alt={`${m.name} business`} loading="lazy" /> : <div className="market-merchant-avatar" aria-hidden="true"><Store /></div>}<div className="p-2.5"><h3 className="truncate text-sm font-semibold">{m.name}</h3><p className="truncate text-[11px] text-muted-foreground">{m.category}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{m.area}</p></div></Link>)}</div>}

    <SectionHead title="Available Products" />
    {catalog.isPending && <p className="py-6 text-center text-sm text-muted-foreground">Loading products…</p>}
    {catalog.isError && <p role="alert" className="py-6 text-center text-sm text-destructive">Products could not be loaded right now. Please try again.</p>}
    <div className="market-grid sm:!grid-cols-4">{products.slice(0, 4).map(p => <div key={p.id} className="market-product relative"><Link to="/product/$id" params={{ id: p.id }}><Photo product={p} /><h2 className="truncate">{p.name}</h2><p className="text-muted-foreground">{p.merchantName}</p></Link><p className="!mt-1 text-sm font-bold">KES {p.price}</p><p className={p.stock > 0 ? "flex items-center gap-1 text-[10px] text-primary" : "flex items-center gap-1 text-[10px] text-destructive"}>{p.stock > 0 ? `Available: ${p.stock}` : "Out of stock"}</p><AddButton p={p} /></div>)}</div>

    <SectionHead title="Recently Added" />
  </Shell>;
}
