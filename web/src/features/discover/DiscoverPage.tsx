import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, Store } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getShops, getZones } from "./api";

export default function DiscoverPage() {
  const [zoneId, setZoneId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

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

  const shops = shopsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const categories = [...new Set(shops.map((shop) => shop.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  const zones = zonesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedZone = zones.find((zone) => zone.id === zoneId);

  return (
    <main className="discover-page">
      <header className="discover-header">
        <div className="discover-header-copy">
          <span className="discover-kicker">BEEZ MARKET</span>
          <h1>Find it nearby.</h1>
          <p>Discover local shops and browse what they have in stock. No account needed.</p>
        </div>
        <label className="discover-zone-field">
          <span>Your area</span>
          <select
            value={zoneId}
            onChange={(event) => {
              setZoneId(event.target.value);
              setCategory("");
            }}
            disabled={zonesQuery.isPending || zonesQuery.isError || !zones.length}
          >
            <option value="">
              {zonesQuery.isPending ? "Finding service areas…" : "Choose your area"}
            </option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="discover-content" aria-label="Local shops">
        <div className="discover-tools">
          <label className="discover-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search shops</span>
            <input
              type="search"
              placeholder="Search shops or products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={!zoneId}
            />
          </label>
          {selectedZone && <p className="discover-zone-note">Shops in {selectedZone.name}</p>}
        </div>

        {zonesQuery.isError && (
          <LoadError
            message={errorMessage(zonesQuery.error)}
            onRetry={() => void zonesQuery.refetch()}
          />
        )}
        {!zonesQuery.isPending && zones.length === 0 && !zonesQuery.hasNextPage && (
          <div className="discover-empty">
            <Store size={28} aria-hidden="true" />
            <h2>Beez isn’t serving an area yet</h2>
            <p>There are no active market areas to browse right now. Please check back soon.</p>
          </div>
        )}
        {shopsQuery.isError && (
          <LoadError
            message={errorMessage(shopsQuery.error)}
            onRetry={() => void shopsQuery.refetch()}
          />
        )}
        {!zoneId && zones.length > 0 && (
          <div className="discover-empty">
            <Store size={28} aria-hidden="true" />
            <h2>Choose an area to start browsing</h2>
            <p>We’ll show you shops serving that market or neighbourhood.</p>
          </div>
        )}
        {zonesQuery.hasNextPage && (
          <button
            className="discover-load-more"
            type="button"
            disabled={zonesQuery.isFetchingNextPage}
            onClick={() => void zonesQuery.fetchNextPage()}
          >
            {zonesQuery.isFetchingNextPage ? "Loading…" : "More areas"}
          </button>
        )}
        {zoneId && shopsQuery.isPending && (
          <p className="discover-status" role="status">
            Loading shops…
          </p>
        )}
        {zoneId && shopsQuery.isSuccess && (
          <>
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
            {shops.length > 0 ? (
              <div className="discover-shop-grid">
                {shops.map((shop) => (
                  <Link
                    className="discover-shop-card"
                    key={shop.id}
                    to="/m/$slug"
                    params={{ slug: shop.slug }}
                  >
                    <span className="discover-shop-mark" aria-hidden="true">
                      {shop.name.slice(0, 1).toLocaleUpperCase()}
                    </span>
                    <span className="discover-shop-copy">
                      <span className="discover-shop-category">{shop.category}</span>
                      <strong>{shop.name}</strong>
                      <small>{shop.isOpen ? "Open for orders" : "Closed"}</small>
                      <small>{shop.locationText ?? shop.zoneName}</small>
                    </span>
                    <span className="discover-shop-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="discover-empty">
                <Store size={28} aria-hidden="true" />
                <h2>No shops found</h2>
                <p>
                  {deferredSearch
                    ? "Try another shop or product name."
                    : "There are no public shops in this area yet."}
                </p>
              </div>
            )}
            {shopsQuery.hasNextPage && (
              <button
                className="discover-load-more"
                type="button"
                disabled={shopsQuery.isFetchingNextPage}
                onClick={() => void shopsQuery.fetchNextPage()}
              >
                {shopsQuery.isFetchingNextPage ? "Loading…" : "Show more shops"}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="discover-error" role="alert">
      <div>
        <strong>We couldn’t load Discover</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function errorMessage(error: Error) {
  return error.message || "Please try again in a moment.";
}
