import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Heart, LayoutGrid, Mic, Minus, Plus, Search, ShoppingCart, SlidersHorizontal, Store, X } from 'lucide-react';
import catGroceries from '@/assets/cat-groceries.webp';
import catElectronics from '@/assets/cat-electronics.webp';
import catFashion from '@/assets/cat-fashion.webp';
import catHomeKitchen from '@/assets/cat-home-kitchen.webp';
import catFurniture from '@/assets/cat-furniture.webp';
import catHealthBeauty from '@/assets/cat-health-beauty.webp';
import catBabyKids from '@/assets/cat-baby-kids.webp';
import catToysGames from '@/assets/cat-toys-games.webp';
import catSportsOutdoors from '@/assets/cat-sports-outdoors.webp';
import catAutomotive from '@/assets/cat-automotive.webp';
import catBooks from '@/assets/cat-books.webp';
import catMusic from '@/assets/cat-music.webp';
import catMovies from '@/assets/cat-movies.webp';
import catToolsGarden from '@/assets/cat-tools-garden.webp';
import catOfficeSupplies from '@/assets/cat-office-supplies.webp';
import catPetSupplies from '@/assets/cat-pet-supplies.webp';
import catServices from '@/assets/cat-services.webp';
import catDigitalGoods from '@/assets/cat-digital-goods.webp';
import catGiftCards from '@/assets/cat-gift-cards.webp';
import { Photo } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { ShopBottomNav } from '@/components/discover/ShopBottomNav';
import { ShopVoiceAssistant } from '@/components/discover/ShopVoiceAssistant';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/lib/shop-data';
import { useFavourites } from '@/lib/favourites';
import { subtotal, type ShopProduct } from '@/lib/marketplace';
import { browse, departmentCounts, departmentOf, DEPARTMENTS, DEPARTMENT_IDS, SORT_LABELS, type DepartmentId, type SortKey } from '@/lib/categories';

type Search = { c?: DepartmentId | 'all'; q?: string; sort?: SortKey; stock?: boolean };
type Patch = { [K in keyof Search]?: Search[K] | undefined };

export const Route = createFileRoute('/groceries')({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    const c = s['c'], q = s['q'], sort = s['sort'], stock = s['stock'];
    if (typeof c === 'string' && (c === 'all' || (DEPARTMENT_IDS as string[]).includes(c))) out.c = c as DepartmentId | 'all';
    if (typeof q === 'string' && q.trim()) out.q = q;
    if (typeof sort === 'string' && sort in SORT_LABELS) out.sort = sort as SortKey;
    if (stock === true || stock === 'true') out.stock = true;
    return out;
  },
  head: () => ({ meta: [
    { title: 'Shop by category | Beez' },
    { name: 'description', content: 'Browse electronics, fashion, home and kitchen, furniture, fresh food, beauty, kids, sports, books and more from local Beez merchants.' },
    { property: 'og:title', content: 'Shop by category on Beez' },
    { property: 'og:description', content: 'Every department from your local market, in one place — search, compare prices and add to cart.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Categories,
});

const ART: Record<DepartmentId | 'all', { img?: string; tint: string }> = {
  all: { img: catGroceries, tint: 'bg-tint-sage' },
  electronics: { img: catElectronics, tint: 'bg-tint-lavender' },
  fashion: { img: catFashion, tint: 'bg-tint-peach' },
  'home-kitchen': { img: catHomeKitchen, tint: 'bg-tint-sage' },
  furniture: { img: catFurniture, tint: 'bg-tint-blue' },
  'groceries-fresh-food': { img: catGroceries, tint: 'bg-tint-rose' },
  'health-beauty': { img: catHealthBeauty, tint: 'bg-tint-lavender' },
  'baby-kids': { img: catBabyKids, tint: 'bg-tint-peach' },
  'toys-games': { img: catToysGames, tint: 'bg-tint-amber' },
  'sports-outdoors': { img: catSportsOutdoors, tint: 'bg-tint-mint' },
  automotive: { img: catAutomotive, tint: 'bg-tint-blue' },
  books: { img: catBooks, tint: 'bg-tint-sage' },
  music: { img: catMusic, tint: 'bg-tint-peach' },
  movies: { img: catMovies, tint: 'bg-tint-lavender' },
  'tools-garden': { img: catToolsGarden, tint: 'bg-tint-mint' },
  'office-supplies': { img: catOfficeSupplies, tint: 'bg-tint-blue' },
  'pet-supplies': { img: catPetSupplies, tint: 'bg-tint-amber' },
  services: { img: catServices, tint: 'bg-tint-rose' },
  'digital-goods': { img: catDigitalGoods, tint: 'bg-tint-lavender' },
  'gift-cards': { img: catGiftCards, tint: 'bg-tint-peach' },
  other: { tint: 'bg-tint-sage' },
};

function labelOf(id: DepartmentId | 'all') { return id === 'all' ? 'All' : DEPARTMENTS.find(d => d.id === id)!.label; }

function DeptArt({ id, className = '' }: { id: DepartmentId | 'all'; className?: string }) {
  const art = ART[id];
  return art.img
    ? <img src={art.img} alt="" loading="lazy" width={1024} height={1024} className={'object-contain ' + className} />
    : <LayoutGrid className={'p-1.5 ' + className} strokeWidth={1.8} />;
}

function Categories() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const dept = search.c ?? 'all';
  const sort = search.sort ?? 'popular';
  const inStockOnly = !!search.stock;
  const [query, setQuery] = useState(search.q ?? '');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listenToken, setListenToken] = useState(0);

  const catalog = useCatalog();
  const products = catalog.data ?? [];
  const { cart } = useMarketplace();
  const counts = useMemo(() => departmentCounts(products), [products]);
  const results = useMemo(() => browse(products, { department: dept, query, sort, inStockOnly }), [products, dept, query, sort, inStockOnly]);
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const cartTotal = subtotal(cart, products);

  const set = (patch: Patch) => navigate({
    search: prev => {
      const next: Record<string, unknown> = { ...prev, ...patch };
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
      return next as Search;
    },
    replace: true,
  });
  const pickDept = (c: DepartmentId | 'all') => { set({ c: c === 'all' ? undefined : c }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  useEffect(() => { const t = setTimeout(() => set({ q: query.trim() || undefined }), 250); return () => clearTimeout(t); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const rail: (DepartmentId | 'all')[] = ['all', ...DEPARTMENT_IDS.filter(id => id !== 'other' || counts.other > 0)];
  const grouped = dept === 'all' && !query.trim();
  const current = dept === 'all' ? null : DEPARTMENTS.find(d => d.id === dept)!;
  const inDept = dept === 'all' ? products.length : counts[dept];

  return (
    <div className="landing min-h-screen pb-40">
      {/* Header + search */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-3 pb-2.5 pt-3">
          <header className="flex items-center gap-2.5">
            <Link to="/discover" aria-label="Back to home" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold leading-tight tracking-tight">Categories</h1>
              <p className="truncate text-[12px] text-muted-foreground">{catalog.isPending ? 'Loading the market…' : `${products.length} products from local shops`}</p>
            </div>
            <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>
          </header>
          <div className="mt-2.5 flex items-center rounded-full border border-border bg-card py-1 pl-4 pr-1 shadow-card focus-within:ring-2 focus-within:ring-primary">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <label htmlFor="cat-search" className="sr-only">Search products</label>
            <input id="cat-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${dept === 'all' ? 'all products' : labelOf(dept).toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-[14px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}
            <button type="button" onClick={() => { setVoiceOpen(true); setListenToken(n => n + 1); }} aria-label="Shop by voice" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Mic className="h-[18px] w-[18px]" strokeWidth={2.4} /></button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl">
        {/* Department rail */}
        <nav aria-label="Departments" className="no-scrollbar sticky top-[7.6rem] h-[calc(100dvh-7.6rem-5.5rem)] w-[5.6rem] shrink-0 overflow-y-auto border-r border-border bg-secondary/50 pb-6 md:w-52">
          <ul>
            {rail.map(id => {
              const active = id === dept;
              const n = id === 'all' ? products.length : counts[id];
              return (
                <li key={id}>
                  <button type="button" onClick={() => pickDept(id)} aria-current={active ? 'true' : undefined}
                    className={'relative flex w-full flex-col items-center gap-1 px-1.5 py-2.5 text-center transition-colors md:flex-row md:gap-3 md:px-3 md:text-left ' + (active ? 'bg-background' : 'hover:bg-background/60')}>
                    <span aria-hidden="true" className={'absolute inset-y-2 left-0 w-1 rounded-r-full ' + (active ? 'bg-primary' : 'bg-transparent')} />
                    <span className={'grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl ' + ART[id].tint + (active ? ' ring-2 ring-primary' : '')}>
                      <DeptArt id={id} className="h-10 w-10" />
                    </span>
                    <span className="min-w-0 md:flex-1">
                      <span className={'block text-[11px] leading-tight md:text-[13px] ' + (active ? 'font-extrabold' : 'font-semibold')}>{labelOf(id)}</span>
                      <span className="block text-[10px] text-muted-foreground md:text-[11px]">{catalog.isPending ? '…' : n}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Results */}
        <main className="min-w-0 flex-1 px-2.5 pt-3 md:px-5">
          <section className={'relative flex items-center overflow-hidden rounded-2xl border border-border/60 p-3.5 ' + ART[dept].tint}>
            <div className="relative z-10 min-w-0 flex-1 pr-20">
              <h2 className="text-lg font-extrabold leading-tight tracking-tight">{current ? current.label : 'Everything'}</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{current ? current.blurb : 'All departments from shops near you'}</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-bold">{catalog.isPending ? 'Loading…' : `${inDept} ${inDept === 1 ? 'product' : 'products'}`}</p>
            </div>
            <DeptArt id={dept} className="absolute -right-2 bottom-0 h-24 w-28 drop-shadow-md" />
          </section>

          {/* Toolbar */}
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => set({ stock: inStockOnly ? undefined : true })} aria-pressed={inStockOnly}
              className={'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ' + (inStockOnly ? 'border-foreground bg-foreground text-background' : 'border-border bg-card')}>
              {inStockOnly && <Check className="h-3.5 w-3.5" strokeWidth={3} />}In stock
            </button>
            <label className="relative ml-auto inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pl-3 pr-2 text-[12px] font-bold">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="sr-only">Sort by</span>
              <select value={sort} onChange={e => set({ sort: e.target.value === 'popular' ? undefined : e.target.value as SortKey })} className="min-w-0 appearance-none bg-transparent pr-1 outline-none">
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
              </select>
            </label>
          </div>

          {query.trim() && !catalog.isPending && (
            <p className="mt-3 text-[12px] text-muted-foreground" aria-live="polite">{results.length} {results.length === 1 ? 'result' : 'results'} for “<span className="font-bold text-foreground">{query.trim()}</span>”{dept !== 'all' && <> in {labelOf(dept)}</>}</p>
          )}

          <div className="mt-3">
            {catalog.isPending ? <SkeletonGrid />
              : catalog.isError ? (
                <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-center">
                  <p className="font-bold">Products could not be loaded</p>
                  <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
                  <button type="button" onClick={() => catalog.refetch()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-extrabold text-primary-foreground">Try again</button>
                </div>
              )
              : results.length === 0 ? (
                <EmptyState dept={dept} query={query.trim()} inStockOnly={inStockOnly}
                  onAll={() => { setQuery(''); navigate({ search: {}, replace: true }); }}
                  onVoice={() => { setVoiceOpen(true); setListenToken(n => n + 1); }} />
              )
              : grouped ? <Grouped products={results} onSeeAll={pickDept} />
              : <Grid products={results} />}
          </div>
        </main>
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-[5.6rem] z-40 px-3">
          <Link to="/cart" className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground shadow-panel">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><ShoppingCart className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] opacity-80">{cartCount} {cartCount === 1 ? 'item' : 'items'} in cart</span>
              <span className="block text-[15px] font-extrabold">KSh {cartTotal.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-extrabold text-primary">View cart <ArrowRight className="h-4 w-4" /></span>
          </Link>
        </div>
      )}

      <ShopVoiceAssistant open={voiceOpen} onOpenChange={setVoiceOpen} listenOnOpen={listenToken} />
      <ShopBottomNav active="Categories" />
    </div>
  );
}

function Grouped({ products, onSeeAll }: { products: ShopProduct[]; onSeeAll: (id: DepartmentId) => void }) {
  const groups = DEPARTMENTS.map(d => ({ d, items: products.filter(p => departmentOf(p) === d.id) })).filter(g => g.items.length);
  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ d, items }) => (
        <section key={d.id} aria-labelledby={`dept-${d.id}`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 id={`dept-${d.id}`} className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
              <span className={'grid h-7 w-7 place-items-center overflow-hidden rounded-lg ' + ART[d.id].tint}><DeptArt id={d.id} className="h-6 w-6" /></span>{d.label}
            </h3>
            <button type="button" onClick={() => onSeeAll(d.id)} className="inline-flex items-center text-[12px] font-bold">See all {items.length}<ChevronRight className="h-4 w-4" /></button>
          </div>
          <Grid products={items.slice(0, 4)} />
        </section>
      ))}
    </div>
  );
}

function Grid({ products }: { products: ShopProduct[] }) {
  return <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{products.map(p => <li key={p.id}><ProductTile p={p} /></li>)}</ul>;
}

function ProductTile({ p }: { p: ShopProduct }) {
  const { cart, change, addFromShop } = useMarketplace();
  const favourites = useFavourites();
  const qty = cart[p.id] ?? 0;
  const out = p.stock <= 0;
  const saved = favourites.has(p.id);
  return (
    <article className={'relative flex h-full flex-col rounded-2xl border border-border bg-card p-2 shadow-card ' + (out ? 'opacity-70' : '')}>
      {out ? <span className="absolute left-2 top-2 z-10 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">Sold out</span>
        : p.stock <= 5 && <span className="absolute left-2 top-2 z-10 rounded-full bg-icon-green px-2 py-0.5 text-[10px] font-bold">Only {p.stock} left</span>}
      <button type="button" onClick={() => favourites.toggle(p.id)} aria-pressed={saved} aria-label={saved ? `Remove ${p.name} from favourites` : `Save ${p.name} to favourites`} className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-card">
        <Heart className={'h-4 w-4 ' + (saved ? 'fill-destructive text-destructive' : '')} />
      </button>
      <Link to="/product/$id" params={{ id: p.id }} className="block">
        <Photo product={p} className="aspect-square rounded-xl !bg-secondary/60 [&_img]:!object-cover" />
        <h4 className="mt-2 line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight">{p.name}</h4>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground"><Store className="h-3 w-3 shrink-0" />{p.merchantName}</p>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-1 pt-2">
        <p className="text-[15px] font-extrabold leading-none">KSh {p.price.toLocaleString()}</p>
        {qty > 0 ? (
          <div className="flex items-center rounded-full bg-primary text-primary-foreground">
            <button type="button" onClick={() => change(p.id, -1, p.price)} aria-label={`Remove one ${p.name}`} className="grid h-8 w-8 place-items-center"><Minus className="h-4 w-4" strokeWidth={2.6} /></button>
            <span className="min-w-[1.1rem] text-center text-[13px] font-extrabold" aria-live="polite">{qty}</span>
            <button type="button" onClick={() => change(p.id, 1, p.price)} disabled={qty >= Math.min(p.stock, 99)} aria-label={`Add one more ${p.name}`} className="grid h-8 w-8 place-items-center disabled:opacity-40"><Plus className="h-4 w-4" strokeWidth={2.6} /></button>
          </div>
        ) : (
          <button type="button" disabled={out} onClick={() => (p.merchantId ? addFromShop({ id: p.id, price: p.price, merchantId: p.merchantId, merchantName: p.merchantName }) : change(p.id, 1, p.price))} aria-label={`Add ${p.name} to cart`} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Plus className="h-4 w-4" strokeWidth={2.6} /></button>
        )}
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="rounded-2xl border border-border bg-card p-2">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="mt-2 h-3.5 w-4/5" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
          <Skeleton className="mt-3 h-4 w-2/5" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ dept, query, inStockOnly, onAll, onVoice }: { dept: DepartmentId | 'all'; query: string; inStockOnly: boolean; onAll: () => void; onVoice: () => void }) {
  const what = query ? `“${query}”` : dept === 'all' ? 'products' : labelOf(dept).toLowerCase();
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
      <span className={'grid h-20 w-20 place-items-center rounded-3xl ' + ART[dept].tint}><DeptArt id={dept} className="h-16 w-16 opacity-80 grayscale-[35%]" /></span>
      <h3 className="mt-4 text-base font-extrabold">No {what} {query ? 'found' : 'yet'}</h3>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
        {inStockOnly ? 'Nothing in stock right now. Turn off “In stock” to see sold-out items too.'
          : query ? 'Try another word, or just tell Beez what you need.'
          : 'Local merchants haven’t listed any here yet. Ask Beez by voice and we’ll find the closest match.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onVoice} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"><Mic className="h-4 w-4" />Ask Beez</button>
        {(dept !== 'all' || query || inStockOnly) && <button type="button" onClick={onAll} className="rounded-full border border-border px-4 py-2 text-sm font-bold">Browse everything</button>}
      </div>
    </div>
  );
}
