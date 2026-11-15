import { describe, expect, it } from 'vitest';
import {
  decodeCursor, encodeCursor, formatDistance, isReelEligible, itemAvailability, limitConsecutive, pageOf,
  rankGlobalFeed, rankShopReel, shopVideo, shouldFetchMore, slideWindow, type ReelItem,
} from '@/lib/reel-feed';
import { cartShopConflict, singleShopError } from '@/lib/marketplace';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
function item(id: string, shopId: string, over: Partial<ReelItem> = {}, shopOver: Partial<ReelItem['shop']> = {}): ReelItem {
  return {
    id, name: id, price: 100, unit: '', stock: 5, active: true, imageUrl: `https://x/${id}.jpg`, imageOrigin: null,
    clipUrl: null, pinned: false, createdAt: daysAgo(0), ...over,
    shop: { id: shopId, name: shopId, path: shopId, area: 'Mombasa', isOpen: true, active: true, lat: -4.0435, lng: 39.6682, imageUrl: null, video: null, ...shopOver },
  };
}

describe('reel eligibility', () => {
  it('skips products without a photo', () => {
    expect(isReelEligible(item('a', 's', { imageUrl: null }))).toBe(false);
  });
  it('skips sold-out products and closed shops', () => {
    expect(isReelEligible(item('a', 's', { stock: 0 }))).toBe(false);
    expect(isReelEligible(item('a', 's', {}, { isOpen: false }))).toBe(false);
    expect(isReelEligible(item('a', 's'))).toBe(true);
  });
  it('reports sold out vs shop closed for slides on screen', () => {
    expect(itemAvailability(item('a', 's', { stock: 0 }))).toBe('sold_out');
    expect(itemAvailability(item('a', 's', {}, { isOpen: false }))).toBe('shop_closed');
    expect(itemAvailability(item('a', 's'))).toBe('available');
  });
});

describe('global feed order', () => {
  it('never shows more than two items in a row from the same shop', () => {
    const list = ['a1', 'a2', 'a3', 'a4'].map(id => item(id, 'A')).concat([item('b1', 'B'), item('b2', 'B')]);
    const ids = limitConsecutive(list).map(i => i.shop.id).join('');
    expect(ids).not.toMatch(/AAA|BBB/);
    expect(ids).toBe('AABAAB');
  });
  it('puts nearer shops first when the shopper shares a location', () => {
    const near = item('near', 'N', {}, { lat: -4.05, lng: 39.67 });
    const far = item('far', 'F', {}, { lat: -3.99, lng: 39.71 });
    const ranked = rankGlobalFeed([far, near], { lat: -4.05, lng: 39.67 }, NOW);
    expect(ranked.map(i => i.id)).toEqual(['near', 'far']);
  });
  it('mixes newness with distance (a much newer item can beat a slightly nearer one)', () => {
    const nearOld = item('nearOld', 'N', { createdAt: daysAgo(10) }, { lat: -4.05, lng: 39.67 });
    const farNew = item('farNew', 'F', { createdAt: daysAgo(0) }, { lat: -4.0, lng: 39.67 });
    expect(rankGlobalFeed([nearOld, farNew], { lat: -4.05, lng: 39.67 }, NOW)[0]!.id).toBe('farNew');
  });
  it('falls back to newest first without a location', () => {
    const ranked = rankGlobalFeed([item('old', 'A', { createdAt: daysAgo(3) }), item('new', 'B', { createdAt: daysAgo(1) })], null, NOW);
    expect(ranked.map(i => i.id)).toEqual(['new', 'old']);
  });
  it('leaves out shops more than 30 km away', () => {
    const nairobi = item('nbo', 'N', {}, { lat: -1.29, lng: 36.82 });
    expect(rankGlobalFeed([nairobi], { lat: -4.05, lng: 39.67 }, NOW)).toEqual([]);
  });
});

describe('shop reel order', () => {
  it('shows pinned products first, then newest', () => {
    const ranked = rankShopReel([item('old', 'S', { createdAt: daysAgo(5) }), item('pin', 'S', { pinned: true, createdAt: daysAgo(9) }), item('new', 'S')]);
    expect(ranked.map(i => i.id)).toEqual(['pin', 'new', 'old']);
  });
});

describe('pagination', () => {
  it('serves 10 items per page with a cursor to the next page', () => {
    const list = Array.from({ length: 23 }, (_, i) => i);
    const first = pageOf(list, { offset: 0, snapshot: daysAgo(0) });
    expect(first.items).toHaveLength(10);
    const second = pageOf(list, decodeCursor(first.nextCursor)!);
    expect(second.items[0]).toBe(10);
    const third = pageOf(list, decodeCursor(second.nextCursor)!);
    expect(third.items).toHaveLength(3);
    expect(third.nextCursor).toBeNull();
  });
  it('rejects broken cursors', () => {
    expect(decodeCursor('abc')).toBeNull();
    expect(decodeCursor(encodeCursor({ offset: 20, snapshot: daysAgo(0) }))?.offset).toBe(20);
  });
  it('asks for the next page when 3 items from the end', () => {
    expect(shouldFetchMore(6, 10, true)).toBe(true);
    expect(shouldFetchMore(5, 10, true)).toBe(false);
    expect(shouldFetchMore(9, 10, false)).toBe(false);
  });
});

describe('slide memory window', () => {
  it('preloads only the next slide and unmounts slides more than two away', () => {
    expect(slideWindow(6, 5)).toBe('preload');
    expect(slideWindow(7, 5)).toBe('unmounted');
    expect(slideWindow(3, 5)).toBe('mounted');
    expect(slideWindow(2, 5)).toBe('unmounted');
  });
});

describe('shop videos shown to customers', () => {
  it('only shows ready intros that an admin approved', () => {
    expect(shopVideo({ video_status: 'processing', video_url: 'u', video_review_status: 'approved' })).toBeNull();
    expect(shopVideo({ video_status: 'ready', video_url: 'u', video_review_status: 'rejected' })).toBeNull();
    expect(shopVideo({ video_status: 'ready', video_url: 'u', video_review_status: 'pending' })).toBeNull();
    expect(shopVideo({ video_status: 'ready', video_url: 'u', video_review_status: 'approved' })?.url).toBe('u');
  });
});

describe('one shop per order', () => {
  it('flags adding from a second shop', () => {
    const shops = { p1: { merchantId: 'A', merchantName: 'Mama Mboga' } };
    expect(cartShopConflict({ p1: 2 }, shops, 'B')?.merchantName).toBe('Mama Mboga');
    expect(cartShopConflict({ p1: 2 }, shops, 'A')).toBeNull();
    expect(cartShopConflict({}, shops, 'B')).toBeNull();
  });
  it('checkout refuses orders that mix shops', () => {
    expect(singleShopError(['A', 'B'])).toMatch(/more than one shop/);
    expect(singleShopError(['A', 'A'])).toBeNull();
  });
});

describe('distance label', () => {
  it('formats metres and kilometres', () => {
    expect(formatDistance(0.42)).toBe('400 m away');
    expect(formatDistance(3.26)).toBe('3.3 km away');
    expect(formatDistance(null)).toBeNull();
  });
});
