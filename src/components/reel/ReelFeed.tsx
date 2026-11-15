import { Link } from '@tanstack/react-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Volume2, VolumeX, ShoppingCart, Plus, Minus, Share2, Store, MapPin, Loader2, WifiOff, RefreshCw, Home, LocateFixed, ChevronsDown, Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMarketplace } from '@/components/marketplace/store';
import {
  fetchGlobalReelPage, fetchLiveStatus, fetchReelProduct, fetchShopReelPage, logReelEvent, type LiveStatus,
} from '@/lib/reel-api';
import {
  formatDistance, itemAvailability, productShareText, shopDistanceKm, shouldFetchMore, slideWindow, whatsappShareUrl,
  type ReelItem, type ReelShop,
} from '@/lib/reel-feed';
import { useCloseOrHome, useCustomerLocation, useLowDataMode, useOnline, useOrigin } from '@/lib/reel-hooks';
import { ReelPhoto, ReelVideo } from './ReelMedia';
import fallbackPhoto from '@/assets/market-produce.jpg';

export type ReelMode = { kind: 'global'; focusProductId?: string | undefined } | { kind: 'shop'; shop: ReelShop };

type Slide =
  | { kind: 'intro'; key: string; shop: ReelShop }
  | { kind: 'product'; key: string; item: ReelItem }
  | { kind: 'loading'; key: string }
  | { kind: 'end'; key: string };

const PULL_TRIGGER = 90;

/** Merge a live database status into an item already in the feed. */
function withLive(item: ReelItem, live: Map<string, LiveStatus | null>): ReelItem {
  if (!live.has(item.id)) return item;
  const status = live.get(item.id);
  if (!status) return { ...item, active: false };
  return { ...item, stock: status.stock, active: status.active, shop: { ...item.shop, ...status.shop, path: item.shop.path || status.shop.path } };
}

export function ReelFeed({ mode }: { mode: ReelMode }) {
  const qc = useQueryClient();
  const close = useCloseOrHome();
  const origin = useOrigin();
  const online = useOnline();
  const [lowData] = useLowDataMode();
  const where = useCustomerLocation();
  const { cart, prices, change, addFromShop } = useMarketplace();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStart = useRef<number | null>(null);
  const [closedShops, setClosedShops] = useState<Set<string>>(() => new Set());
  const [live, setLive] = useState<Map<string, LiveStatus | null>>(() => new Map());
  const notified = useRef(new Set<string>());
  const viewed = useRef(new Set<string>());

  const isGlobal = mode.kind === 'global';
  const shop = mode.kind === 'shop' ? mode.shop : null;
  const focusId = mode.kind === 'global' ? mode.focusProductId : undefined;
  const waitingForLocation = isGlobal && (!where.ready || where.needsAsk);
  const location = where.location;

  const feedKey = isGlobal
    ? ['reel', 'global', location ? `${location.lat.toFixed(2)},${location.lng.toFixed(2)}` : 'anywhere']
    : ['reel', 'shop', shop!.id];
  const feed = useInfiniteQuery({
    queryKey: feedKey,
    enabled: !waitingForLocation,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => (isGlobal ? fetchGlobalReelPage(location, pageParam) : fetchShopReelPage(shop!.id, pageParam)),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });
  const focus = useQuery({
    queryKey: ['reel-product', focusId],
    enabled: !!focusId,
    queryFn: () => fetchReelProduct(focusId!),
    staleTime: 60_000,
  });

  // Slides: optional shop intro, the products, then a loading or end slide.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const list: ReelItem[] = [];
    const add = (item: ReelItem | null | undefined) => { if (item && !seen.has(item.id)) { seen.add(item.id); list.push(item); } };
    if (focusId) add(focus.data);
    for (const page of feed.data?.pages ?? []) page.items.forEach(add);
    return list;
  }, [feed.data, focus.data, focusId]);

  const baseSlides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (shop?.video) out.push({ kind: 'intro', key: 'intro', shop });
    items.forEach(item => out.push({ kind: 'product', key: item.id, item }));
    return out;
  }, [items, shop]);

  // Products from a shop that just closed are skipped once they're ahead of the shopper.
  const slides = useMemo<Slide[]>(() => {
    const out = baseSlides.filter((s, i) => i <= active || s.kind !== 'product' || !closedShops.has(s.item.shop.id));
    if (feed.hasNextPage || feed.isFetchingNextPage) out.push({ kind: 'loading', key: 'loading' });
    else if (out.some(s => s.kind === 'product')) out.push({ kind: 'end', key: 'end' });
    return out;
  }, [baseSlides, active, closedShops, feed.hasNextPage, feed.isFetchingNextPage]);

  const productCount = slides.filter(s => s.kind === 'product').length;
  const current = slides[active];

  // Track which slide is on screen.
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (index !== active) { setActive(index); setPaused(false); }
  };
  const goTo = (index: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: index * el.clientHeight, behavior: 'smooth' });
  };

  // Next page when 3 from the end.
  const loadedProducts = items.length;
  const activeProductIndex = Math.max(0, active - (shop?.video ? 1 : 0));
  useEffect(() => {
    if (shouldFetchMore(activeProductIndex, loadedProducts, !!feed.hasNextPage) && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [activeProductIndex, loadedProducts, feed]);

  // Live availability for the slide on screen and the next two.
  const watched = useMemo(() => slides.slice(active, active + 3).flatMap(s => (s.kind === 'product' ? [s.item] : [])), [slides, active]);
  const watchKey = watched.map(i => i.id).join(',');
  useEffect(() => {
    if (!watched.length) return;
    const ids = watched.map(i => i.id);
    const shopIds = [...new Set(watched.map(i => i.shop.id))];
    let cancelled = false;
    const refresh = () => {
      fetchLiveStatus(ids)
        .then(map => { if (!cancelled) setLive(prev => new Map([...prev, ...map])); })
        .catch(() => { /* keep showing what we have; add-to-cart rechecks */ });
    };
    refresh();
    const channel = supabase
      .channel(`reel-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `id=in.(${ids.join(',')})` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchants', filter: `id=in.(${shopIds.join(',')})` }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey]);

  // React to items selling out or shops closing while on screen.
  useEffect(() => {
    for (const [id, status] of live) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      const merged = withLive(item, live);
      const state = itemAvailability(merged);
      if (state === 'shop_closed' && !closedShops.has(item.shop.id)) {
        setClosedShops(prev => new Set(prev).add(item.shop.id));
      }
      if (state !== 'available' && (cart[id] ?? 0) > 0 && !notified.current.has(id)) {
        notified.current.add(id);
        change(id, -(cart[id] ?? 0));
        toast(`${item.name} was removed from your cart`, { description: state === 'shop_closed' ? 'The shop just closed.' : 'It just sold out.' });
      }
      void status;
    }
  }, [live, items, cart, change, closedShops]);

  // Count a view once a product has been on screen for a second.
  useEffect(() => {
    if (current?.kind !== 'product' && current?.kind !== 'intro') return;
    const timer = window.setTimeout(() => {
      if (current.kind === 'product' && !viewed.current.has(current.item.id)) {
        viewed.current.add(current.item.id);
        logReelEvent('view', current.item.shop.id, current.item.id);
      }
      if (current.kind === 'intro' && !viewed.current.has(`intro-${current.shop.id}`)) {
        viewed.current.add(`intro-${current.shop.id}`);
        logReelEvent('intro_view', current.shop.id, null);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [current]);

  // Desktop: arrow keys move between slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); goTo(Math.min(slides.length - 1, active + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goTo(Math.max(0, active - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setClosedShops(new Set());
    setLive(new Map());
    notified.current.clear();
    scroller.current?.scrollTo({ top: 0 });
    setActive(0);
    await qc.resetQueries({ queryKey: feedKey });
    if (focusId) await qc.invalidateQueries({ queryKey: ['reel-product', focusId] });
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, feedKey.join('|'), focusId]);

  // Pull down on the first slide to refresh.
  const onTouchStart = (e: React.TouchEvent) => {
    pullStart.current = scroller.current && scroller.current.scrollTop <= 0 ? e.touches[0]!.clientY : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current == null) return;
    const delta = e.touches[0]!.clientY - pullStart.current;
    setPull(delta > 0 ? Math.min(delta / 2, 110) : 0);
  };
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER / 1.5 && !refreshing) void refresh();
    pullStart.current = null;
    setPull(0);
  };

  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, n]) => s + (prices[id] ?? 0) * n, 0);

  const add = async (item: ReelItem) => {
    if (!online) { toast("You're offline", { description: 'Reconnect to add items.' }); return; }
    setAdding(item.id);
    try {
      // The database is asked again: the live view is never the only protection.
      const fresh = await fetchLiveStatus([item.id]);
      setLive(prev => new Map([...prev, ...fresh]));
      const merged = withLive(item, fresh);
      const state = itemAvailability(merged);
      if (state !== 'available') {
        toast(state === 'shop_closed' ? `${item.shop.name} just closed` : `${item.name} just sold out`);
        return;
      }
      if ((cart[item.id] ?? 0) >= Math.min(merged.stock, 99)) {
        toast(`Only ${merged.stock} available`);
        return;
      }
      addFromShop(
        { id: item.id, price: item.price, merchantId: item.shop.id, merchantName: item.shop.name },
        () => logReelEvent('add', item.shop.id, item.id),
      );
    } catch {
      toast('Could not add right now', { description: 'Please check your connection and try again.' });
    } finally {
      setAdding(null);
    }
  };

  const share = (item: ReelItem) => {
    logReelEvent('share', item.shop.id, item.id);
    window.open(whatsappShareUrl(productShareText(item, origin)), '_blank', 'noopener');
  };

  const currentHasVideo = current?.kind === 'intro' || (current?.kind === 'product' && !!current.item.clipUrl);
  const showLoading = waitingForLocation ? false : feed.isPending || (!!focusId && focus.isPending);
  const loadFailed = feed.isError && !items.length;
  const empty = !showLoading && !feed.isError && !waitingForLocation && slides.every(s => s.kind !== 'product' && s.kind !== 'intro');

  return (
    <div className="landing reel-scope fixed inset-0 overflow-hidden">
      <div className="relative mx-auto h-full max-w-md">
        {/* Pull-to-refresh indicator */}
        {(pull > 0 || refreshing) && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center" style={{ transform: `translateY(${pull}px)` }}>
            <span className="reel-glass grid h-10 w-10 place-items-center rounded-full">
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
            </span>
          </div>
        )}

        {/* Top bar */}
        <div className="reel-scrim-top absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-6 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <button type="button" onClick={close} aria-label="Close reel" className="reel-glass grid h-10 w-10 place-items-center rounded-full"><X className="h-5 w-5" /></button>
          <p className="truncate text-sm font-bold">{shop ? shop.name : 'Reel'}</p>
          <div className="flex items-center gap-2">
            {currentHasVideo && (
              <button type="button" onClick={() => setMuted(m => !m)} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} className="reel-glass grid h-10 w-10 place-items-center rounded-full">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
            <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="reel-glass relative grid h-10 w-10 place-items-center rounded-full">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>
          </div>
        </div>

        {!online && (
          <div role="status" className="absolute inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.25rem)] z-30 flex items-center gap-2 rounded-2xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground">
            <WifiOff className="h-4 w-4 shrink-0" /> You're offline, reconnect to add items
          </div>
        )}

        {/* Ask for location once */}
        {waitingForLocation && where.ready && (
          <CenterCard>
            <LocateFixed className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 text-xl font-extrabold">See shops near you</h1>
            <p className="mt-1 text-sm opacity-80">We use your location only to show products from the closest open shops first.</p>
            <button type="button" disabled={where.locating} onClick={where.request} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground disabled:opacity-60">
              {where.locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />} Use my location
            </button>
            <button type="button" onClick={where.skip} className="mt-2 w-full rounded-full px-5 py-3 font-bold opacity-80">Skip</button>
          </CenterCard>
        )}

        {showLoading && <SkeletonSlide />}

        {loadFailed && (
          <CenterCard>
            <h1 className="text-xl font-extrabold">The reel didn't load</h1>
            <p className="mt-1 text-sm opacity-80">{online ? 'Something went wrong on our side.' : "You're offline."} Please try again.</p>
            <button type="button" onClick={() => void feed.refetch()} className="mt-5 w-full rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Try again</button>
          </CenterCard>
        )}

        {empty && (
          <CenterCard>
            <Store className="mx-auto h-10 w-10 text-primary" />
            {isGlobal ? (
              <>
                <h1 className="mt-3 text-xl font-extrabold">No shops near you yet</h1>
                <p className="mt-1 text-sm opacity-80">Open shops with product photos will show up here.</p>
                <Link to="/groceries" className="mt-5 block w-full rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Browse all shops</Link>
                <button type="button" onClick={() => { where.reset(); }} className="mt-2 w-full rounded-full px-5 py-3 font-bold opacity-80">Change location</button>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-xl font-extrabold">No products in this reel yet</h1>
                <p className="mt-1 text-sm opacity-80">{shop!.name} hasn't added products with photos yet.</p>
                <Link to="/shop/$slug" params={{ slug: shop!.path }} className="mt-5 block w-full rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Visit shop</Link>
              </>
            )}
          </CenterCard>
        )}

        {/* The swipe feed */}
        {!showLoading && !loadFailed && !empty && !waitingForLocation && (
          <div
            ref={scroller}
            onScroll={onScroll}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="reel-scroll h-full snap-y snap-mandatory overflow-y-scroll"
            aria-label="Product reel"
          >
            {slides.map((slide, index) => {
              const windowState = slideWindow(index, active);
              return (
                <section key={slide.key} className="relative h-full w-full snap-start snap-always overflow-hidden" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
                  {windowState === 'unmounted' ? null : slide.kind === 'loading' ? (
                    <SkeletonSlide />
                  ) : slide.kind === 'end' ? (
                    <EndSlide shop={shop} onRefresh={() => void refresh()} />
                  ) : slide.kind === 'intro' ? (
                    <IntroSlide
                      shop={slide.shop}
                      active={index === active}
                      muted={muted}
                      paused={paused}
                      lowData={lowData}
                      onTogglePause={() => setPaused(p => !p)}
                      onSkip={() => goTo(index + 1)}
                    />
                  ) : (
                    <ProductSlide
                      item={withLive(slide.item, live)}
                      active={index === active}
                      muted={muted}
                      paused={paused}
                      lowData={lowData}
                      inCart={cart[slide.item.id] ?? 0}
                      adding={adding === slide.item.id}
                      online={online}
                      distance={formatDistance(shopDistanceKm(slide.item.shop, location))}
                      position={{ index: index - (shop?.video ? 1 : 0), total: productCount, more: !!feed.hasNextPage }}
                      raised={cartCount > 0}
                      onTogglePause={() => setPaused(p => !p)}
                      onAdd={() => void add(slide.item)}
                      onRemove={() => change(slide.item.id, -1)}
                      onShare={() => share(slide.item)}
                    />
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Sticky checkout bar, in place of the tab bar */}
        {cartCount > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
            <Link to="/cart" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-[15px] font-extrabold text-primary-foreground shadow-lg">
              <ShoppingCart className="h-5 w-5" /> View cart · {cartCount} {cartCount === 1 ? 'item' : 'items'} · KSh {cartTotal.toLocaleString()}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center px-6">
      <div className="w-full max-w-sm rounded-3xl bg-ink-foreground/5 p-6 text-center ring-1 ring-ink-foreground/10">{children}</div>
    </div>
  );
}

function SkeletonSlide() {
  return (
    <div className="absolute inset-0" aria-label="Loading products" role="status">
      <div className="reel-shimmer absolute inset-0 opacity-60" />
      <div className="absolute bottom-24 left-4 right-20 space-y-3">
        <div className="reel-shimmer h-6 w-3/4 rounded-full" />
        <div className="reel-shimmer h-5 w-1/3 rounded-full" />
        <div className="reel-shimmer h-4 w-1/2 rounded-full" />
      </div>
      <div className="absolute bottom-28 right-3 space-y-4">
        {[0, 1, 2].map(i => <div key={i} className="reel-shimmer h-12 w-12 rounded-full" />)}
      </div>
    </div>
  );
}

function EndSlide({ shop, onRefresh }: { shop: ReelShop | null; onRefresh: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-6 text-center">
      <div>
        <h2 className="text-2xl font-extrabold">{shop ? `That's everything from ${shop.name}` : "You've seen everything nearby"}</h2>
        <p className="mt-2 text-sm opacity-80">{shop ? 'Visit the shop page to see all of their products.' : 'New products from nearby shops show up here first.'}</p>
        <div className="mt-6 grid gap-2">
          {shop ? (
            <Link to="/shop/$slug" params={{ slug: shop.path }} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Visit shop</Link>
          ) : (
            <button type="button" onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"><RefreshCw className="h-4 w-4" />Refresh</button>
          )}
          <Link to="/discover" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/25"><Home className="h-4 w-4" />Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

function IntroSlide({ shop, active, muted, paused, lowData, onTogglePause, onSkip }: {
  shop: ReelShop; active: boolean; muted: boolean; paused: boolean; lowData: boolean; onTogglePause: () => void; onSkip: () => void;
}) {
  const [progress, setProgress] = useState(0);
  return (
    <div className="absolute inset-0" onClick={onTogglePause}>
      <ReelVideo src={shop.video!.url} poster={shop.video!.thumbUrl} active={active} muted={muted} loop={false} lowData={lowData} sizeBytes={shop.video!.sizeBytes} paused={paused} onProgress={setProgress} />
      <div className="absolute inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.25rem)] z-10 h-1 overflow-hidden rounded-full bg-ink-foreground/25">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="reel-scrim-bottom absolute inset-x-0 bottom-0 px-4 pb-28 pt-24">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Meet the shop</p>
        <h2 className="mt-1 text-2xl font-extrabold">{shop.name}</h2>
        {shop.area && <p className="text-sm opacity-80">{shop.area}</p>}
        <button type="button" onClick={(e) => { e.stopPropagation(); onSkip(); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">
          <ChevronsDown className="h-5 w-5" /> Skip to products
        </button>
      </div>
      {paused && active && <PausedBadge />}
    </div>
  );
}

function PausedBadge() {
  return <span className="reel-glass pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-bold">Paused</span>;
}

function ProductSlide({
  item, active, muted, paused, lowData, inCart, adding, online, distance, position, raised, onTogglePause, onAdd, onRemove, onShare,
}: {
  item: ReelItem; active: boolean; muted: boolean; paused: boolean; lowData: boolean; inCart: number; adding: boolean; online: boolean;
  distance: string | null; position: { index: number; total: number; more: boolean }; raised: boolean;
  onTogglePause: () => void; onAdd: () => void; onRemove: () => void; onShare: () => void;
}) {
  const state = itemAvailability(item);
  const unavailable = state !== 'available';
  const hasClip = !!item.clipUrl;
  const atMax = inCart >= Math.min(item.stock, 99);
  return (
    // Photo slides ignore taps so nothing is triggered by accident; clip slides pause/play.
    <div className="absolute inset-0" onClick={hasClip ? onTogglePause : undefined}>
      {hasClip ? (
        <ReelVideo src={item.clipUrl!} poster={item.clipThumbUrl ?? item.imageUrl} active={active} muted={muted} loop lowData={lowData} sizeBytes={null} paused={paused} />
      ) : (
        <>
          <ReelPhoto src={item.imageUrl ?? fallbackPhoto} alt={item.name} zoom={!lowData && active && !unavailable} dimmed={unavailable} />
          {/* Tells shoppers this slide is a still photo, not a clip. */}
          <span className="reel-glass absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.75rem)] z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Photo
          </span>
        </>
      )}
      {unavailable && (
        <div className="absolute inset-0 grid place-items-center bg-ink/55">
          <span className="rounded-full bg-ink-foreground px-5 py-2 text-base font-extrabold text-ink">{state === 'shop_closed' ? 'Shop closed' : 'Sold out'}</span>
        </div>
      )}
      {hasClip && paused && active && <PausedBadge />}

      {/* Right-side action rail */}
      <div className={`absolute right-3 z-10 flex flex-col items-center gap-4 ${raised ? 'bottom-44' : 'bottom-28'}`} onClick={(e) => e.stopPropagation()}>
        {inCart > 0 && !unavailable ? (
          <div className="flex flex-col items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg">
            <button type="button" aria-label={`Add one more ${item.name}`} disabled={atMax || adding || !online} onClick={onAdd} className="grid h-11 w-12 place-items-center disabled:opacity-40">
              {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={3} />}
            </button>
            <span className="text-base font-extrabold" aria-live="polite">{inCart}</span>
            <button type="button" aria-label={`Remove one ${item.name}`} onClick={onRemove} className="grid h-11 w-12 place-items-center"><Minus className="h-5 w-5" strokeWidth={3} /></button>
          </div>
        ) : (
          <RailButton label={unavailable ? (state === 'shop_closed' ? 'Closed' : 'Sold out') : 'Add'} onClick={onAdd} disabled={unavailable || adding || !online} primary>
            {adding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" strokeWidth={3} />}
          </RailButton>
        )}
        <RailButton label="Share" onClick={onShare}><Share2 className="h-6 w-6" /></RailButton>
        <Link to="/shop/$slug" params={{ slug: item.shop.path }} onClick={() => logReelEvent('visit_shop', item.shop.id, item.id)} className="flex flex-col items-center gap-1 text-[11px] font-bold">
          <span className="reel-glass grid h-12 w-12 place-items-center rounded-full"><Store className="h-6 w-6" /></span>
          Visit shop
        </Link>
      </div>

      {/* Bottom overlay */}
      <div className={`reel-scrim-bottom absolute inset-x-0 bottom-0 pl-4 pr-20 pt-28 ${raised ? 'pb-24' : 'pb-6'}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="line-clamp-2 text-xl font-extrabold leading-tight">{item.name}</h2>
        <p className="mt-1 text-lg font-extrabold text-primary">
          KSh {item.price.toLocaleString()}{item.unit ? <span className="text-sm font-bold text-ink-foreground/80"> / {item.unit}</span> : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link to="/shop/$slug" params={{ slug: item.shop.path }} onClick={() => logReelEvent('visit_shop', item.shop.id, item.id)} className="inline-flex items-center gap-1 font-bold underline-offset-2 hover:underline">
            <Store className="h-4 w-4" />{item.shop.name}
          </Link>
          {distance && <span className="opacity-80">· {distance}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${item.shop.isOpen ? 'bg-icon-green text-ink' : 'bg-ink-foreground/20'}`}>{item.shop.isOpen ? 'Open' : 'Closed'}</span>
        </div>
        {/* Position in the feed */}
        <div className="mt-3 flex items-center gap-2" aria-label={`Product ${position.index + 1} of ${position.total}${position.more ? ' or more' : ''}`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-foreground/20">
            <div className="h-full rounded-full bg-ink-foreground/80" style={{ width: `${Math.min(100, ((position.index + 1) / Math.max(1, position.total)) * 100)}%` }} />
          </div>
          <span className="text-[11px] font-bold opacity-80">{position.index + 1}/{position.total}{position.more ? '+' : ''}</span>
        </div>
      </div>
    </div>
  );
}

function RailButton({ label, onClick, disabled, primary, children }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 text-[11px] font-bold disabled:opacity-50">
      <span className={`grid h-12 w-12 place-items-center rounded-full ${primary ? 'bg-primary text-primary-foreground shadow-lg' : 'reel-glass'}`}>{children}</span>
      {label}
    </button>
  );
}
