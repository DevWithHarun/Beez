// Browser data access for the reel, shop page and intro player. Only public,
// customer-visible rows are read (RLS: active products and shops).
import { supabase } from '@/integrations/supabase/client';
import {
  decodeCursor, encodeCursor, pageOf, rankGlobalFeed, rankShopReel, shopVideo,
  type LatLng, type ReelItem, type ReelShop,
} from '@/lib/reel-feed';

type MerchantRow = Record<string, unknown> & { id: string; name: string; area?: string; active?: boolean; image_url?: string | null };
type ProductRow = Record<string, unknown> & { id: string; name: string; price_kes: number; stock: number; active: boolean; created_at: string; image_url: string | null; merchant: MerchantRow | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POOL_LIMIT = 400;

export function toReelShop(row: MerchantRow): ReelShop {
  const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    id: row.id,
    name: row.name,
    path: typeof row['slug'] === 'string' && row['slug'] ? (row['slug'] as string) : row.id,
    area: row.area ?? '',
    // Shops are open unless the merchant switched them off.
    isOpen: row['is_open'] !== false,
    active: row.active !== false,
    lat: num(row['latitude']),
    lng: num(row['longitude']),
    imageUrl: row.image_url ?? null,
    video: shopVideo(row as Parameters<typeof shopVideo>[0]),
  };
}

function toReelItem(row: ProductRow): ReelItem | null {
  if (!row.merchant) return null;
  return {
    id: row.id,
    name: row.name,
    price: row.price_kes,
    unit: typeof row['unit'] === 'string' ? (row['unit'] as string) : '',
    stock: row.stock,
    active: row.active,
    imageUrl: row.image_url,
    imageOrigin: (row['image_origin'] as string | null) ?? null,
    clipUrl: (row['clip_url'] as string | null) ?? null,
    clipThumbUrl: (row['clip_thumb_url'] as string | null) ?? null,
    reelHidden: row['reel_hidden'] === true,
    reelPosition: typeof row['reel_position'] === 'number' ? (row['reel_position'] as number) : null,
    pinned: row['pinned'] === true,
    createdAt: row.created_at,
    shop: toReelShop(row.merchant),
  };
}

const PRODUCT_SELECT = '*, merchant:merchants!inner(*)';

async function loadPool(filter: { merchantId?: string; before?: string }) {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('active', true)
    .gt('stock', 0)
    // A product needs an approved clip or a photo to be shown.
    .or('image_url.not.is.null,clip_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(POOL_LIMIT);
  if (filter.merchantId) query = query.eq('merchant_id', filter.merchantId);
  if (filter.before) query = query.lte('created_at', filter.before);
  const { data, error } = await query;
  if (error) throw new Error('The reel could not be loaded right now. Please try again.');
  return ((data ?? []) as unknown as ProductRow[]).map(toReelItem).filter((x): x is ReelItem => !!x);
}

export type ReelPage = { items: ReelItem[]; nextCursor: string | null };

/** Global feed page: nearby open shops, distance + newness, 10 per page. */
export async function fetchGlobalReelPage(location: LatLng | null, cursor: string | null): Promise<ReelPage> {
  const position = decodeCursor(cursor) ?? { offset: 0, snapshot: new Date().toISOString() };
  const pool = await loadPool({ before: position.snapshot });
  return pageOf(rankGlobalFeed(pool, location), position);
}

/** One shop's reel (pinned first, then newest), 10 per page. */
export async function fetchShopReelPage(merchantId: string, cursor: string | null): Promise<ReelPage> {
  const position = decodeCursor(cursor) ?? { offset: 0, snapshot: new Date().toISOString() };
  const pool = await loadPool({ merchantId, before: position.snapshot });
  return pageOf(rankShopReel(pool), position);
}

export function firstCursor() {
  return encodeCursor({ offset: 0, snapshot: new Date().toISOString() });
}

/** The product a shared link points at, if it can still be shown. */
export async function fetchReelProduct(productId: string): Promise<ReelItem | null> {
  if (!UUID.test(productId)) return null;
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', productId).maybeSingle();
  if (error || !data) return null;
  return toReelItem(data as unknown as ProductRow);
}

/** A shop by its public link (slug), or by id for older links. */
export async function fetchShop(slugOrId: string): Promise<ReelShop | null> {
  const query = supabase.from('merchants').select('*');
  const { data, error } = UUID.test(slugOrId)
    ? await query.eq('id', slugOrId).maybeSingle()
    : await query.eq('slug' as 'id', slugOrId).maybeSingle();
  if (error) {
    // Before shop links exist in the database, the slug filter errors; treat as not found.
    if (!UUID.test(slugOrId)) return null;
    throw new Error('This shop could not be loaded right now. Please try again.');
  }
  return data ? toReelShop(data as unknown as MerchantRow) : null;
}

/** All of a shop's visible products (for the shop page grid). */
export async function fetchShopProducts(merchantId: string): Promise<ReelItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Products could not be loaded right now. Please try again.');
  return ((data ?? []) as unknown as ProductRow[])
    .map(toReelItem)
    .filter((x): x is ReelItem => !!x)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

/** Shops for the Home screen cards. */
export async function fetchHomeShops(): Promise<ReelShop[]> {
  const { data, error } = await supabase.from('merchants').select('*').eq('active', true).order('created_at', { ascending: false }).limit(12);
  if (error) throw new Error('Shops could not be loaded right now. Please try again.');
  return ((data ?? []) as unknown as MerchantRow[]).map(toReelShop);
}

export type LiveStatus = { id: string; stock: number; active: boolean; shop: ReelShop };

/**
 * Fresh availability from the database for the given products. Products that
 * were switched off (or whose shop went inactive) come back missing.
 */
export async function fetchLiveStatus(ids: string[]): Promise<Map<string, LiveStatus | null>> {
  const result = new Map<string, LiveStatus | null>(ids.map(id => [id, null]));
  if (!ids.length) return result;
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).in('id', ids);
  if (error) throw new Error('Availability could not be checked. Please try again.');
  for (const row of (data ?? []) as unknown as ProductRow[]) {
    if (!row.merchant) continue;
    result.set(row.id, { id: row.id, stock: row.stock, active: row.active, shop: toReelShop(row.merchant) });
  }
  return result;
}

export type ReelEvent = 'view' | 'add' | 'share' | 'visit_shop' | 'intro_view';

/** Pilot analytics. Never blocks or breaks the shopping flow. */
export function logReelEvent(event: ReelEvent, merchantId: string, productId: string | null) {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await supabase.from('reel_events').insert({
        event,
        merchant_id: merchantId,
        product_id: productId,
        user_id: data.session?.user.id ?? null,
      });
    } catch {
      /* analytics is best effort */
    }
  })();
}
