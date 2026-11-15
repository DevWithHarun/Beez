import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Bell, MapPin, ShoppingCart, Heart, Search, Mic, Check } from 'lucide-react';
import { useState } from 'react';
import beezMark from '@/assets/beez-mark.png';
import { Photo } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { ShopBottomNav } from '@/components/discover/ShopBottomNav';
import { HeroCarousel } from '@/components/discover/HeroCarousel';
import { ShopVoiceAssistant } from '@/components/discover/ShopVoiceAssistant';
import { ShopCards, WatchReelButton } from '@/components/discover/ShopCards';
import { useCatalog } from '@/lib/shop-data';
import { useFavourites } from '@/lib/favourites';
import type { ShopProduct } from '@/lib/marketplace';

export const Route = createFileRoute('/discover')({
  head: () => ({ meta: [{ title: 'Discover. Shop. Grow with Beez' }, { name: 'description', content: 'Shop groceries, fruits, electronics and fashion from local merchants. Voice shopping, reels, WhatsApp orders and M-Pesa payments.' }, { property: 'og:title', content: 'Discover. Shop. Grow with Beez!' }, { property: 'og:description', content: 'Voice commerce, reels and fast delivery — all in one app.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Discover,
});

function Logo() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-1" aria-label="Beez home">
      <img src={beezMark} alt="" className="h-10 w-10 shrink-0 object-contain min-[380px]:h-12 min-[380px]:w-12" />
      <div className="min-w-0">
        <div className="text-[26px] font-extrabold leading-[0.9] tracking-tight min-[380px]:text-[30px]">Beez</div>
        <div className="mt-0.5 whitespace-nowrap text-[9.5px] font-semibold tracking-tight">Smart Tools. Real Growth.</div>
      </div>
    </Link>
  );
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{n > 99 ? '99+' : n}</span>;
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>
      <Link to="/groceries" className="flex items-center gap-1 text-[12px] font-semibold">See All <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}

function ProductCard({ p, saved, onSave }: { p: ShopProduct; saved: boolean; onSave: () => void }) {
  const { cart, change, addFromShop } = useMarketplace();
  const inCart = cart[p.id] ?? 0;
  const add = () => (p.merchantId ? addFromShop({ id: p.id, price: p.price, merchantId: p.merchantId, merchantName: p.merchantName }) : change(p.id, 1, p.price));
  const out = p.stock <= 0;
  return (
    <article className="relative flex w-[8.6rem] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-2 shadow-card">
      {!out && p.stock <= 5 && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-icon-green px-2 py-0.5 text-[10px] font-bold">Only {p.stock} left</span>
      )}
      {out && <span className="absolute left-2 top-2 z-10 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">Sold out</span>}
      <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? `Remove ${p.name} from favourites` : `Save ${p.name} to favourites`} className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-card/90">
        <Heart className={'h-4 w-4 ' + (saved ? 'fill-destructive text-destructive' : '')} />
      </button>
      <Link to="/product/$id" params={{ id: p.id }} className="block">
        <Photo product={p} className="h-[5.5rem] rounded-xl !bg-card [&_img]:!object-contain" />
        <h3 className="mt-2 line-clamp-2 min-h-[2.4em] text-[12.5px] leading-tight">{p.name}</h3>
      </Link>
      <div className="mt-1 flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight">KSh {p.price.toLocaleString()}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">{p.merchantName}</p>
        </div>
        <button type="button" disabled={out || inCart >= Math.min(p.stock, 99)} onClick={add} aria-label={inCart ? `${p.name} in cart (${inCart}), add one more` : `Add ${p.name} to cart`} className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
          {inCart ? <Check className="h-4 w-4" strokeWidth={3} /> : <ShoppingCart className="h-4 w-4" strokeWidth={2.4} />}
        </button>
      </div>
    </article>
  );
}

function Discover() {
  const { cart } = useMarketplace();
  const favourites = useFavourites();
  const catalog = useCatalog();
  const products = catalog.data ?? [];
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listenToken, setListenToken] = useState(0);
  const openVoice = () => { setVoiceOpen(true); setListenToken(n => n + 1); };

  return (
    <div className="landing min-h-screen pb-28">
      <div className="mx-auto max-w-3xl px-2.5">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 pt-3">
          <Logo />
          <div className="flex shrink-0 items-center gap-2.5 pr-1 min-[380px]:gap-3.5">
            <button type="button" aria-label="Notifications" className="relative"><Bell className="h-6 w-6" strokeWidth={2} /></button>
            <Link to="/track" className="flex flex-col items-center text-[10px] font-semibold leading-none"><MapPin className="mb-0.5 h-5 w-5" strokeWidth={2.2} />Track</Link>
            <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="relative"><ShoppingCart className="h-6 w-6" strokeWidth={2} /><Badge n={cartCount} /></Link>
            <span className="relative" aria-label={`${favourites.ids.length} saved products`}><Heart className="h-6 w-6" strokeWidth={2} /><Badge n={favourites.ids.length} /></span>
          </div>
        </header>

        {/* Search */}
        <div className="mt-3 flex items-center rounded-full border border-border bg-secondary/60 py-1 pl-4 pr-1">
          <Link to="/groceries" className="flex min-w-0 flex-1 items-center gap-2.5">
            <Search className="h-5 w-5 shrink-0" strokeWidth={2.2} />
            <span className="truncate text-[13px] text-muted-foreground">Search products, shops or services...</span>
          </Link>
          <button type="button" onClick={openVoice} aria-label="Shop by voice" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Mic className="h-5 w-5" strokeWidth={2.4} /></button>
        </div>

        <h1 className="sr-only">Discover. Shop. Grow with Beez!</h1>
        <HeroCarousel />
        <WatchReelButton />
        <ShopCards />

        {/* Trending products */}
        <section className="mt-3">
          <SectionHead title="Trending Products" />
          {catalog.isPending && <p className="py-8 text-center text-sm text-muted-foreground">Loading products…</p>}
          {catalog.isError && <p role="alert" className="py-8 text-center text-sm text-destructive">Products could not be loaded right now. Please try again.</p>}
          {!catalog.isPending && !catalog.isError && products.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No products yet — check back soon.</p>}
          {products.length > 0 && (
            <div className="no-scrollbar -mx-2.5 flex snap-x gap-2 overflow-x-auto px-2.5 pb-3">
              {products.slice(0, 10).map(p => <ProductCard key={p.id} p={p} saved={favourites.has(p.id)} onSave={() => favourites.toggle(p.id)} />)}
            </div>
          )}
        </section>
      </div>

      <ShopVoiceAssistant open={voiceOpen} onOpenChange={setVoiceOpen} listenOnOpen={listenToken} />
      <ShopBottomNav active="Home" />
    </div>
  );
}
