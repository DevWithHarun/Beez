import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Clapperboard, Play, Store } from 'lucide-react';
import { homeShopsQuery } from '@/lib/shop-queries';

/** Home: "Watch reel" entry point. */
export function WatchReelButton() {
  return (
    <Link to="/reel" className="mt-3 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground shadow-card">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Clapperboard className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold leading-tight">Watch reel</span>
        <span className="block truncate text-xs opacity-80">Swipe products from shops near you</span>
      </span>
      <Play className="h-5 w-5 shrink-0 fill-current" />
    </Link>
  );
}

/** Home: shop cards with a play icon when the shop has an intro video. */
export function ShopCards() {
  const shops = useQuery(homeShopsQuery);
  if (shops.isError || (shops.data && shops.data.length === 0)) return null;
  return (
    <section className="mt-4">
      <h2 className="mb-2 px-1 text-[17px] font-extrabold tracking-tight">Shops near you</h2>
      <div className="no-scrollbar -mx-2.5 flex snap-x gap-2 overflow-x-auto px-2.5 pb-3">
        {shops.isPending && [0, 1, 2].map(i => <div key={i} className="h-36 w-36 shrink-0 animate-pulse rounded-2xl bg-secondary" />)}
        {shops.data?.map(shop => {
          const cover = shop.video?.thumbUrl ?? shop.imageUrl;
          return (
            <article key={shop.id} className="relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <Link to="/shop/$slug" params={{ slug: shop.path }} className="block">
                <div className="relative h-24 bg-secondary">
                  {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Store className="h-8 w-8 text-muted-foreground" /></div>}
                </div>
                <div className="p-2">
                  <h3 className="truncate text-[13px] font-extrabold">{shop.name}</h3>
                  <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${shop.isOpen ? 'bg-icon-green' : 'bg-muted-foreground'}`} />
                    <span className="truncate">{shop.isOpen ? 'Open' : 'Closed'}{shop.area ? ` · ${shop.area}` : ''}</span>
                  </p>
                </div>
              </Link>
              {shop.video && (
                <Link to="/shop/$slug/intro" params={{ slug: shop.path }} aria-label={`Play ${shop.name} intro video`} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-ink-foreground">
                  <Play className="h-4 w-4 fill-current" />
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
