import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Play, Clapperboard, ShoppingCart, Check, Loader2, MapPin, Share2, Store } from 'lucide-react';
import { useMarketplace } from '@/components/marketplace/store';
import { Photo } from '@/components/marketplace/shared';
import { ShopState } from '@/components/reel/ShopState';
import { shopProductsQuery, shopQuery } from '@/lib/shop-queries';
import { fetchLiveStatus, logReelEvent } from '@/lib/reel-api';
import { formatDistance, introShareText, itemAvailability, shopDistanceKm, whatsappShareUrl, type ReelItem } from '@/lib/reel-feed';
import { useCloseOrHome, useCustomerLocation, useOnline, useOrigin } from '@/lib/reel-hooks';

export const Route = createFileRoute('/shop/$slug')({
  head: () => ({
    meta: [
      { title: 'Shop on Beez – order from a local merchant' },
      { name: 'description', content: "See a local shop's products, watch their intro video and order for delivery." },
      { property: 'og:title', content: 'Shop on Beez' },
      { property: 'og:description', content: 'Order from a local shop on Beez, with delivery.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { slug } = Route.useParams();
  const shop = useQuery(shopQuery(slug));
  const products = useQuery(shopProductsQuery(shop.data?.id));
  const { cart, addFromShop } = useMarketplace();
  const back = useCloseOrHome();
  const where = useCustomerLocation();
  const online = useOnline();
  const origin = useOrigin();
  const [adding, setAdding] = useState<string | null>(null);

  if (shop.isPending) return <ShopState kind="loading" />;
  if (shop.isError) return <ShopState kind="error" onRetry={() => void shop.refetch()} />;
  if (!shop.data) return <ShopState kind="missing" />;
  const s = shop.data;
  const distance = formatDistance(shopDistanceKm(s, where.location));
  const cartCount = Object.values(cart).reduce((n, q) => n + q, 0);

  const add = async (item: ReelItem) => {
    if (!online) { toast("You're offline", { description: 'Reconnect to add items.' }); return; }
    setAdding(item.id);
    try {
      const live = (await fetchLiveStatus([item.id])).get(item.id);
      const state = live ? itemAvailability({ ...live, shop: live.shop }) : 'sold_out';
      if (state !== 'available') { toast(state === 'shop_closed' ? `${s.name} is closed right now` : `${item.name} just sold out`); void products.refetch(); return; }
      if ((cart[item.id] ?? 0) >= Math.min(live!.stock, 99)) { toast(`Only ${live!.stock} available`); return; }
      addFromShop({ id: item.id, price: item.price, merchantId: s.id, merchantName: s.name }, () => toast(`${item.name} added to cart`));
    } catch {
      toast('Could not add right now', { description: 'Please check your connection and try again.' });
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="landing min-h-[100dvh] pb-28">
      <div className="mx-auto max-w-3xl">
        <header className="relative">
          <div className="relative h-44 overflow-hidden bg-secondary sm:h-56">
            {s.video?.thumbUrl || s.imageUrl ? (
              <img src={s.video?.thumbUrl ?? s.imageUrl!} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center"><Store className="h-14 w-14 text-muted-foreground" /></div>
            )}
            <button type="button" onClick={back} aria-label="Go back" className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-card/90 shadow-card"><ArrowLeft className="h-5 w-5" /></button>
            <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-card/90 shadow-card">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{cartCount}</span>}
            </Link>
            {s.video && (
              <Link to="/shop/$slug/intro" params={{ slug: s.path }} aria-label={`Play ${s.name} intro video`} className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-ink/60 text-ink-foreground">
                <Play className="h-7 w-7 fill-current" />
              </Link>
            )}
          </div>
          <div className="px-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold leading-tight">{s.name}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {s.area && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{s.area}</span>}
                  {distance && <span>· {distance}</span>}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${s.isOpen ? 'bg-icon-green text-ink' : 'bg-secondary text-muted-foreground'}`}>{s.isOpen ? 'Open' : 'Closed'}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.video && (
                <Link to="/shop/$slug/intro" params={{ slug: s.path }} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-extrabold text-ink-foreground"><Play className="h-4 w-4 fill-current" />Play</Link>
              )}
              <Link to="/shop/$slug/reel" params={{ slug: s.path }} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground"><Clapperboard className="h-4 w-4" />Browse products</Link>
              {s.video && (
                <button type="button" onClick={() => { logReelEvent('share', s.id, null); window.open(whatsappShareUrl(introShareText(s, origin)), '_blank', 'noopener'); }} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-bold"><Share2 className="h-4 w-4" />Share</button>
              )}
            </div>
            {!s.isOpen && <p role="status" className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-sm">This shop is closed right now. You can look around, but ordering opens when they do.</p>}
          </div>
        </header>

        <section className="px-4 pt-6">
          <h2 className="mb-3 text-lg font-extrabold">Products</h2>
          {products.isPending && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-secondary" />)}</div>}
          {products.isError && <p role="alert" className="py-8 text-center text-sm text-destructive">Products could not be loaded. <button type="button" className="font-bold underline" onClick={() => void products.refetch()}>Try again</button></p>}
          {products.data && products.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No products yet — check back soon.</p>}
          {products.data && products.data.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.data.map(item => {
                const state = itemAvailability(item);
                const inCart = cart[item.id] ?? 0;
                return (
                  <article key={item.id} className="flex flex-col rounded-2xl border border-border bg-card p-2 shadow-card">
                    <Link to="/product/$id" params={{ id: item.id }}>
                      <Photo product={item} className="aspect-square rounded-xl !bg-card [&_img]:!object-cover" />
                      <h3 className="mt-2 line-clamp-2 min-h-[2.4em] text-sm leading-tight">{item.name}</h3>
                    </Link>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold">KSh {item.price.toLocaleString()}{item.unit && <span className="text-xs font-semibold text-muted-foreground"> / {item.unit}</span>}</p>
                        {state === 'sold_out' && <p className="text-xs font-bold text-muted-foreground">Sold out</p>}
                      </div>
                      <button
                        type="button"
                        disabled={state !== 'available' || adding === item.id || inCart >= Math.min(item.stock, 99)}
                        onClick={() => void add(item)}
                        aria-label={inCart ? `${item.name} in cart (${inCart}), add one more` : `Add ${item.name} to cart`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                      >
                        {adding === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : inCart ? <Check className="h-4 w-4" strokeWidth={3} /> : <ShoppingCart className="h-4 w-4" />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          <Link to="/cart" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 font-extrabold text-primary-foreground shadow-lg"><ShoppingCart className="h-5 w-5" />View cart · {cartCount} {cartCount === 1 ? 'item' : 'items'}</Link>
        </div>
      )}
    </div>
  );
}
