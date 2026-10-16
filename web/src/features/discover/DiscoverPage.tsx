import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Info,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { addCartProduct, readCart, type CartLine } from "./cart";
import { getShop, getShops, getZones, type PublicProduct } from "./api";
import "./discover.css";

export default function DiscoverPage() {
  const [zoneId, setZoneId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartMessage, setCartMessage] = useState("");
  const cartDialogRef = useRef<HTMLElement>(null);
  const cartCloseRef = useRef<HTMLButtonElement>(null);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    const syncCart = () => setCart(readCart());
    syncCart();
    window.addEventListener("beez-cart-change", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("beez-cart-change", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    if (!cartOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cartCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = cartDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [cartOpen]);

  const zonesQuery = useInfiniteQuery({
    queryKey: ["discover", "zones"],
    queryFn: ({ pageParam }) => getZones(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
    retry: false,
  });
  const shopsQuery = useInfiniteQuery({
    queryKey: ["discover", "shops", zoneId, category, deferredSearch],
    queryFn: ({ pageParam }) =>
      getShops({
        zone: zoneId,
        category: category || undefined,
        query: deferredSearch || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(zoneId),
    staleTime: 30_000,
    retry: false,
  });
  const categoryQuery = useInfiniteQuery({
    queryKey: ["discover", "categories", zoneId, deferredSearch],
    queryFn: ({ pageParam }) =>
      getShops({
        zone: zoneId,
        query: deferredSearch || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(zoneId),
    staleTime: 30_000,
    retry: false,
  });

  const shopPages = shopsQuery.data?.pages;
  const categoryPages = categoryQuery.data?.pages;
  const zonePages = zonesQuery.data?.pages;
  const shops = useMemo(() => shopPages?.flatMap((page) => page.items) ?? [], [shopPages]);
  const categoryShops = useMemo(
    () => categoryPages?.flatMap((page) => page.items) ?? [],
    [categoryPages],
  );
  const categories = useMemo(
    () => [...new Set(categoryShops.map((shop) => shop.category))].sort((a, b) => a.localeCompare(b)),
    [categoryShops],
  );
  const zones = useMemo(() => zonePages?.flatMap((page) => page.items) ?? [], [zonePages]);
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const productQueries = useQueries({
    queries: shops.map((shop) => ({
      queryKey: ["discover", "shop-products", shop.slug],
      queryFn: () => getShop(shop.slug),
      enabled: Boolean(zoneId),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const products = productQueries.flatMap((query) => query.data?.products ?? []);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartZoneName = cart[0]?.zoneName;
  const productErrors = productQueries.filter((query) => query.isError);
  const productDetailsPending = productQueries.some((query) => query.isPending);

  function addProduct(product: PublicProduct, shop: (typeof shops)[number]) {
    if (!selectedZone) return;
    if (!shop.isOpen) {
      setCartMessage(`${shop.name} is closed and cannot accept orders right now.`);
      return;
    }
    const result = addCartProduct({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      zoneId: selectedZone.id,
      zoneName: selectedZone.name,
      shopName: shop.name,
      shopSlug: shop.slug,
    });
    if (result === "added") {
      setCart(readCart());
      setCartMessage(`${product.name} added to your basket.`);
    } else if (result === "different-zone") {
      setCartMessage(`Your basket is for ${cartZoneName ?? "another area"}. Products must be from one area.`);
    } else {
      setCartMessage("Your basket has reached its item limit.");
    }
  }

  const isEmptyServiceAreaList =
    !zonesQuery.isPending && !zonesQuery.isError && zones.length === 0 && !zonesQuery.hasNextPage;

  return (
    <main className="discover-marketplace">
      <div className="discover-shell">
        <header className="discover-topbar">
          <div className="discover-title-group">
            <span className="discover-brand-mark" aria-hidden="true">b</span>
            <div>
              <span className="discover-eyebrow">BEEZ MARKET</span>
              <h1>Discover</h1>
            </div>
          </div>
          <button
            type="button"
            className="discover-basket-button"
            aria-label={`Open basket, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
            aria-expanded={cartOpen}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>Basket</span>
            {cartCount > 0 && <b className="discover-basket-count">{cartCount}</b>}
          </button>
        </header>

        <div className="discover-controls">
          <div className="discover-search">
            <Search size={19} aria-hidden="true" />
            <label className="sr-only" htmlFor="discover-query">Search shops and products</label>
            <input
              id="discover-query"
              type="search"
              placeholder="Search products, shops…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={!zoneId}
            />
            {search && (
              <button
                type="button"
                className="discover-clear-search"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="discover-zone-select">
            <MapPin size={17} aria-hidden="true" />
            <span className="sr-only">Choose your area</span>
            <select
                id="discover-area-select"
              value={zoneId}
              onChange={(event) => {
                setZoneId(event.target.value);
                setCategory("");
                setCartMessage("");
              }}
              disabled={zonesQuery.isPending || zonesQuery.isError || !zones.length}
            >
              <option value="">
                {zonesQuery.isPending ? "Finding areas…" : "Choose your area"}
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>

        {zonesQuery.isError && (
          <LoadError
            message={errorMessage(zonesQuery.error)}
            onRetry={() => void zonesQuery.refetch()}
          />
        )}
        {zonesQuery.isPending && (
          <div className="discover-area-loading" role="status" aria-label="Loading service areas">
            <span />
            <div><i /><i /></div>
          </div>
        )}
        {isEmptyServiceAreaList && (
          <EmptyState
            icon={<MapPin size={22} aria-hidden="true" />}
            title="No service areas just yet"
            body="Beez is not serving a neighbourhood here yet. Please check back soon."
          />
        )}

        {zonesQuery.hasNextPage && (
          <button
            className="discover-more-areas"
            type="button"
            disabled={zonesQuery.isFetchingNextPage}
            onClick={() => void zonesQuery.fetchNextPage()}
          >
            {zonesQuery.isFetchingNextPage ? "Loading areas…" : "Load more areas"}
          </button>
        )}

        {!zoneId && !isEmptyServiceAreaList && (
          <section className="discover-welcome" aria-labelledby="discover-welcome-title">
            <div className="discover-welcome-copy">
              <span className="discover-welcome-kicker"><MapPin size={13} /> LOCAL, BY DESIGN</span>
              <h2 id="discover-welcome-title">Good things,<br />close by.</h2>
              <p>Choose your area to see real shops and products available around you.</p>
              {!zonesQuery.isError && zones.length > 0 && (
                <button
                  type="button"
                  className="discover-welcome-cta"
                  onClick={() => document.getElementById("discover-area-select")?.focus()}
                >
                  Choose an area <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="discover-welcome-art" aria-hidden="true">
              <span className="art-ring art-ring-one" />
              <span className="art-ring art-ring-two" />
              <span className="art-orbit-dot" />
              <Store size={58} strokeWidth={1.15} />
              <span className="art-leaf art-leaf-one" />
              <span className="art-leaf art-leaf-two" />
            </div>
          </section>
        )}

        {zoneId && (
          <>
            <section className="discover-local-banner" aria-label="Your selected neighbourhood">
              <div className="discover-local-icon"><MapPin size={18} aria-hidden="true" /></div>
              <div>
                <span>SHOPPING IN</span>
                <strong>{selectedZone?.name ?? "Your area"}</strong>
              </div>
              <p>Browse nearby shops and their current catalogue.</p>
              <span className="discover-banner-sun" aria-hidden="true" />
            </section>

            <section className="discover-section discover-products-section" aria-labelledby="discover-products-title">
              <div className="discover-section-heading">
                <div>
                  <span className="discover-section-overline">FROM LOCAL SHOPS</span>
                  <h2 id="discover-products-title">Products around you</h2>
                  <p>Items listed by shops in {selectedZone?.name ?? "your area"}.</p>
                </div>
                <ShoppingBag className="discover-section-icon" size={23} aria-hidden="true" />
              </div>

              {categoryQuery.isError && (
                <LoadError
                  message={errorMessage(categoryQuery.error)}
                  onRetry={() => void categoryQuery.refetch()}
                />
              )}
              {categories.length > 0 && (
                <div className="discover-categories" aria-label="Filter shops by category">
                  <button
                    type="button"
                    className={!category ? "is-selected" : ""}
                    aria-pressed={!category}
                    onClick={() => setCategory("")}
                  >
                    All shops
                  </button>
                  {categories.map((item) => (
                    <button
                      type="button"
                      className={category === item ? "is-selected" : ""}
                      aria-pressed={category === item}
                      key={item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}

              {shopsQuery.isError && (
                <LoadError
                  message={errorMessage(shopsQuery.error)}
                  onRetry={() => void shopsQuery.refetch()}
                />
              )}
              {shopsQuery.isPending && <ProductSkeletons />}
              {shopsQuery.isSuccess && (
                <>
                  {shops.length > 0 && products.length > 0 && (
                    <div className="discover-product-grid">
                      {shops.flatMap((shop, shopIndex) => {
                        const details = productQueries[shopIndex]?.data;
                        return (details?.products ?? []).map((product) => (
                          <ProductCard
                            key={`${shop.id}-${product.id}`}
                            product={product}
                            shop={shop}
                            onAdd={() => addProduct(product, shop)}
                          />
                        ));
                      })}
                    </div>
                  )}
                  {shops.length > 0 && productDetailsPending && products.length === 0 && (
                    <ProductSkeletons />
                  )}
                  {shops.length > 0 && productErrors.length > 0 && (
                    <div className="discover-inline-error" role="status">
                      <span>Some shop catalogues could not be loaded.</span>
                      <button
                        type="button"
                        onClick={() => productErrors.forEach((query) => void query.refetch())}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {shops.length > 0 && !productDetailsPending && products.length === 0 && productErrors.length === 0 && (
                    <EmptyState
                      icon={<Package size={22} aria-hidden="true" />}
                      title="No products to show yet"
                      body="These shops have not listed products in their public catalogues yet."
                    />
                  )}
                  {shops.length === 0 && !shopsQuery.isPending && (
                    <EmptyState
                      icon={<Search size={22} aria-hidden="true" />}
                      title="No matches in this area"
                      body={deferredSearch
                        ? "Try another shop or product name, or choose a different category."
                        : "There are no public shops in this area yet."}
                    />
                  )}
                  {shopsQuery.hasNextPage && (
                    <button
                      className="discover-load-more"
                      type="button"
                      disabled={shopsQuery.isFetchingNextPage}
                      onClick={() => void shopsQuery.fetchNextPage()}
                    >
                      {shopsQuery.isFetchingNextPage ? "Loading shops…" : "Show more shops"}
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="discover-section discover-shops-section" aria-labelledby="discover-shops-title">
              <div className="discover-section-heading">
                <div>
                  <span className="discover-section-overline">MEET THE NEIGHBOURHOOD</span>
                  <h2 id="discover-shops-title">Shops in {selectedZone?.name ?? "your area"}</h2>
                  <p>Go straight to a shop to explore its full catalogue.</p>
                </div>
                <Store className="discover-section-icon" size={23} aria-hidden="true" />
              </div>
              {shopsQuery.isSuccess && shops.length > 0 && (
                <div className="discover-shop-list">
                  {shops.map((shop) => (
                    <Link
                      className="discover-shop-row"
                      key={shop.id}
                      to="/m/$slug"
                      params={{ slug: shop.slug }}
                    >
                      <span className="discover-shop-avatar" aria-hidden="true">
                        {shop.name.slice(0, 1).toLocaleUpperCase()}
                      </span>
                      <span className="discover-shop-details">
                        <span className="discover-shop-category">{shop.category}</span>
                        <strong>{shop.name}</strong>
                        <small>{shop.locationText || shop.zoneName}</small>
                      </span>
                      <span className={`discover-open-state ${shop.isOpen ? "is-open" : "is-closed"}`}>
                        <span />
                        {shop.isOpen ? "Open" : "Closed"}
                      </span>
                      <ArrowRight size={17} className="discover-shop-arrow" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {cartMessage && (
        <div className="discover-cart-toast" role="status" aria-live="polite">
          <Info size={16} aria-hidden="true" />
          <span>{cartMessage}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setCartMessage("")}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {cartOpen && (
        <div className="discover-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false);
        }}>
          <section
            className="discover-cart-dialog"
            ref={cartDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-cart-title"
          >
            <div className="discover-cart-heading">
              <div>
                <span className="discover-section-overline">YOUR BASKET</span>
                <h2 id="discover-cart-title">A little local haul</h2>
              </div>
              <button ref={cartCloseRef} type="button" className="discover-icon-button" aria-label="Close basket" onClick={() => setCartOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            {cart.length > 0 ? (
              <>
                <p className="discover-cart-zone">
                  <MapPin size={15} aria-hidden="true" /> All items are for <strong>{cartZoneName}</strong>
                </p>
                <ul className="discover-cart-lines">
                  {cart.map((line) => (
                    <li key={line.productId}>
                      <span className="discover-cart-product-icon"><Package size={18} aria-hidden="true" /></span>
                      <span className="discover-cart-line-copy">
                        <strong>{line.name}</strong>
                        <small>{line.shopName}{line.unit ? ` · ${line.unit}` : ""}</small>
                      </span>
                      <span className="discover-cart-qty">×{line.qty}</span>
                    </li>
                  ))}
                </ul>
                <p className="discover-cart-footnote">Prices and delivery are confirmed when your basket is prepared.</p>
              </>
            ) : (
              <div className="discover-cart-empty">
                <span><ShoppingBag size={25} aria-hidden="true" /></span>
                <strong>Your basket is empty</strong>
                <p>Browse local products and add something you need.</p>
              </div>
            )}
            <button type="button" className="discover-cart-done" onClick={() => setCartOpen(false)}>
              Back to Discover <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function ProductCard({
  product,
  shop,
  onAdd,
}: {
  product: PublicProduct;
  shop: { slug: string; name: string; category: string; isOpen: boolean };
  onAdd: () => void;
}) {
  return (
    <article className="discover-product-card">
      <Link
        className={`discover-product-art tone-${colorTone(product.name)}`}
        to="/m/$slug"
        params={{ slug: shop.slug }}
        aria-label={`View ${product.name} at ${shop.name}`}
      >
        <span className="discover-product-orbit" aria-hidden="true" />
        <Package size={33} strokeWidth={1.3} aria-hidden="true" />
        <span className="discover-art-word">{product.name.slice(0, 1).toLocaleUpperCase()}</span>
      </Link>
      <div className="discover-product-info">
        <span className="discover-product-shop">{shop.name}</span>
        <Link
          className="discover-product-name"
          to="/m/$slug"
          params={{ slug: shop.slug }}
        >
          {product.name}
        </Link>
        {product.unit && <span className="discover-product-unit">{product.unit}</span>}
        <div className="discover-product-bottom">
          <span className="discover-product-price">
            <small>KES</small> {product.priceKes.toLocaleString("en-KE")}
          </span>
          <button
            className="discover-add-button"
            type="button"
            onClick={onAdd}
            disabled={!product.inStock || !shop.isOpen}
            aria-label={
              !shop.isOpen
                ? `${shop.name} is closed`
                : product.inStock
                  ? `Add ${product.name} to basket`
                  : `${product.name} is out of stock`
            }
            title={!shop.isOpen ? "Shop closed" : product.inStock ? "Add to basket" : "Out of stock"}
          >
            {product.inStock && shop.isOpen
              ? <ShoppingCart size={16} aria-hidden="true" />
              : <X size={16} aria-hidden="true" />}
          </button>
        </div>
        <span className={`discover-stock ${product.inStock && shop.isOpen ? "in-stock" : "out-of-stock"}`}>
          {!shop.isOpen ? "Shop closed" : product.inStock ? "In stock" : "Out of stock"}
        </span>
      </div>
    </article>
  );
}

function ProductSkeletons() {
  return (
    <div className="discover-product-grid" role="status" aria-label="Loading products">
      {[0, 1, 2, 3].map((item) => (
        <div className="discover-product-skeleton" key={item}>
          <span />
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="discover-empty">
      <span className="discover-empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="discover-error" role="alert">
      <div>
        <strong>We couldn’t load this just now</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Please check your connection and try again.";
}

function colorTone(value: string) {
  const tones = ["mint", "sand", "sky", "rose"];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return tones[Math.abs(hash) % tones.length] ?? "mint";
}
