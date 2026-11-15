// Pure rules for the Product Reel feed. No network or browser access here,
// so the ranking can be tested and reused by any caller.
import { coordsFor } from '@/lib/marketplace';

export type LatLng = { lat: number; lng: number };

export type ShopVideo = {
  url: string;
  thumbUrl: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
};

export type ReelShop = {
  id: string;
  name: string;
  /** Public link part: /shop/{path}. Falls back to the id until a slug exists. */
  path: string;
  area: string;
  isOpen: boolean;
  active: boolean;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  video: ShopVideo | null;
};

export type ReelItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  active: boolean;
  imageUrl: string | null;
  imageOrigin: string | null;
  /** Only set once an admin approved the clip ("live"). */
  clipUrl: string | null;
  clipThumbUrl?: string | null;
  /** Merchant chose "Hide from reel". */
  reelHidden?: boolean;
  /** Merchant's pinned order (1 = first); null when not pinned. */
  reelPosition?: number | null;
  pinned: boolean;
  createdAt: string;
  shop: ReelShop;
};

export const REEL_PAGE_SIZE = 10;
/** Fetch the next page when the shopper is this many items from the end. */
export const REEL_PREFETCH_DISTANCE = 3;
/** Shops with a known pin farther than this are not "nearby". */
export const NEARBY_KM = 30;
/** One day older ranks like this many km farther away. */
export const KM_PER_DAY = 1.5;
/** One vendor may fill at most this many slides in a row. */
export const MAX_CONSECUTIVE_PER_SHOP = 2;

type MerchantVideoRow = {
  video_url?: string | null;
  video_thumb_url?: string | null;
  video_duration?: number | string | null;
  video_size_bytes?: number | string | null;
  video_status?: string | null;
  video_review_status?: string | null;
};

/** Customers only ever see a finished intro video that an admin approved. */
export function shopVideo(row: MerchantVideoRow): ShopVideo | null {
  if (row.video_status !== 'ready' || !row.video_url) return null;
  if (row.video_review_status !== 'approved') return null;
  const duration = row.video_duration == null ? null : Number(row.video_duration);
  const size = row.video_size_bytes == null ? null : Number(row.video_size_bytes);
  return {
    url: row.video_url,
    thumbUrl: row.video_thumb_url ?? null,
    durationSec: Number.isFinite(duration) ? duration : null,
    sizeBytes: Number.isFinite(size) ? size : null,
  };
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The shop's saved pin, or an approximate pin from its area name. */
export function shopCoords(shop: Pick<ReelShop, 'lat' | 'lng' | 'area'>): LatLng {
  if (shop.lat != null && shop.lng != null) return { lat: shop.lat, lng: shop.lng };
  return coordsFor(shop.area || 'Mombasa');
}

export function shopDistanceKm(shop: Pick<ReelShop, 'lat' | 'lng' | 'area'>, from: LatLng | null): number | null {
  return from ? distanceKm(from, shopCoords(shop)) : null;
}

export function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** Video slide when the product has an approved clip, else a photo slide, else nothing. */
export function reelMediaKind(item: Pick<ReelItem, 'clipUrl' | 'imageUrl'>): 'video' | 'photo' | null {
  if (item.clipUrl) return 'video';
  if (item.imageUrl) return 'photo';
  return null;
}

/**
 * Can this product appear in a reel? Needs an approved clip or a photo,
 * stock, an open shop, and the merchant not hiding it.
 */
export function isReelEligible(item: ReelItem): boolean {
  return item.active && item.stock > 0 && !item.reelHidden && reelMediaKind(item) !== null && item.shop.active && item.shop.isOpen;
}

const hasVideo = (item: ReelItem) => Number(reelMediaKind(item) === 'video');

/** Live "can it be bought right now" check for a slide already on screen. */
export function itemAvailability(item: Pick<ReelItem, 'active' | 'stock'> & { shop: Pick<ReelShop, 'active' | 'isOpen'> }): 'available' | 'sold_out' | 'shop_closed' {
  if (!item.shop.active || !item.shop.isOpen) return 'shop_closed';
  if (!item.active || item.stock <= 0) return 'sold_out';
  return 'available';
}

/**
 * Reorders so no shop fills more than `max` slides in a row. Keeps the
 * original order otherwise; if only one shop is left it simply continues.
 */
export function limitConsecutive<T extends { shop: { id: string } }>(items: T[], max = MAX_CONSECUTIVE_PER_SHOP): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length) {
    const tail = out.slice(-max);
    const blocked = tail.length === max && tail.every(t => t.shop.id === tail[0]!.shop.id) ? tail[0]!.shop.id : null;
    const index = blocked ? pool.findIndex(p => p.shop.id !== blocked) : 0;
    out.push(pool.splice(index === -1 ? 0 : index, 1)[0]!);
  }
  return out;
}

function ageDays(iso: string, now: number) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : 365;
}

/**
 * Global feed order: eligible products only, nearby shops only (when the
 * shopper shared a location), mixing distance with newness, then spread so a
 * single vendor can't dominate. Without a location it is simply newest first.
 */
export function rankGlobalFeed(items: ReelItem[], location: LatLng | null, now = Date.now()): ReelItem[] {
  const eligible = items.filter(isReelEligible);
  const scored = eligible
    .map(item => {
      const km = shopDistanceKm(item.shop, location);
      const days = ageDays(item.createdAt, now);
      return { item, km, score: km == null ? days : km + days * KM_PER_DAY };
    })
    .filter(s => s.km == null || s.km <= NEARBY_KM)
    // Videos first, so the best content leads; photo slides follow.
    .sort((a, b) => hasVideo(b.item) - hasVideo(a.item) || a.score - b.score || b.item.createdAt.localeCompare(a.item.createdAt) || a.item.id.localeCompare(b.item.id));
  return limitConsecutive(scored.map(s => s.item));
}

const position = (item: ReelItem) => item.reelPosition ?? Number.MAX_SAFE_INTEGER;

/** A single shop's reel: videos first, then photos; each in the merchant's order, then pinned, then newest. */
export function rankShopReel(items: ReelItem[]): ReelItem[] {
  return items
    .filter(isReelEligible)
    .sort((a, b) =>
      hasVideo(b) - hasVideo(a)
      || position(a) - position(b)
      || Number(b.pinned) - Number(a.pinned)
      || b.createdAt.localeCompare(a.createdAt)
      || a.id.localeCompare(b.id));
}

export type ReelCursor = { offset: number; snapshot: string };

export function encodeCursor(cursor: ReelCursor): string {
  return `${cursor.offset}.${cursor.snapshot}`;
}

export function decodeCursor(value: string | null | undefined): ReelCursor | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  const offset = Number(value.slice(0, dot));
  const snapshot = value.slice(dot + 1);
  if (dot < 1 || !Number.isInteger(offset) || offset < 0 || !Number.isFinite(Date.parse(snapshot))) return null;
  return { offset, snapshot };
}

/** Cursor pagination over a ranked list. The snapshot keeps later pages stable. */
export function pageOf<T>(ranked: T[], cursor: ReelCursor, pageSize = REEL_PAGE_SIZE): { items: T[]; nextCursor: string | null } {
  const items = ranked.slice(cursor.offset, cursor.offset + pageSize);
  const next = cursor.offset + items.length;
  return { items, nextCursor: next < ranked.length ? encodeCursor({ offset: next, snapshot: cursor.snapshot }) : null };
}

/** Should the next page be requested now? */
export function shouldFetchMore(activeIndex: number, loaded: number, hasMore: boolean): boolean {
  return hasMore && loaded - 1 - activeIndex <= REEL_PREFETCH_DISTANCE;
}

/** Slides farther than this from the one on screen are unmounted. */
export function slideWindow(index: number, active: number): 'mounted' | 'preload' | 'unmounted' {
  if (index === active + 1) return 'preload';
  if (index > active + 1) return 'unmounted';
  return active - index <= 2 ? 'mounted' : 'unmounted';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function productShareText(item: Pick<ReelItem, 'name' | 'price' | 'unit' | 'id'> & { shop: Pick<ReelShop, 'name'> }, origin: string): string {
  const unit = item.unit ? ` ${item.unit}` : '';
  return `${item.name} – KSh ${item.price.toLocaleString()}${unit} at ${item.shop.name} on Beez. ${origin}/reel?p=${item.id}`;
}

export function introShareText(shop: Pick<ReelShop, 'name' | 'path'>, origin: string): string {
  return `Meet ${shop.name} on Beez – watch their shop video: ${origin}/shop/${shop.path}/intro`;
}
