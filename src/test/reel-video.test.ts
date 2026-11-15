import { describe, expect, it } from 'vitest';
import { canStopRecording, PRODUCT_CLIP_LIMITS, shouldAutoStop, validateVideo } from '@/lib/merchant-video';
import { isReelEligible, rankGlobalFeed, rankShopReel, reelMediaKind, type ReelItem } from '@/lib/reel-feed';
import { clipReviewState, introReviewState, productReelStatus, rejectFix, setupChecklist } from '@/lib/reel-video';

const NOW = Date.parse('2026-11-15T12:00:00Z');
function item(id: string, over: Partial<ReelItem> = {}): ReelItem {
  return {
    id, name: id, price: 100, unit: '', stock: 5, active: true, imageUrl: `https://x/${id}.jpg`, imageOrigin: null,
    clipUrl: null, pinned: false, createdAt: new Date(NOW).toISOString(), ...over,
    shop: { id: 's', name: 's', path: 's', area: 'Mombasa', isOpen: true, active: true, lat: -4.04, lng: 39.67, imageUrl: null, video: null },
  };
}
const product = { id: 'p', active: true, stock: 3, image_url: 'https://x/p.jpg' };

describe('product clip length', () => {
  const ok = { durationSec: 10, sizeBytes: 3_000_000, mimeType: 'video/mp4' };
  it('allows stopping from 8 seconds and stops itself at 15', () => {
    expect(canStopRecording(7.9, PRODUCT_CLIP_LIMITS)).toBe(false);
    expect(canStopRecording(8, PRODUCT_CLIP_LIMITS)).toBe(true);
    expect(shouldAutoStop(14.9, PRODUCT_CLIP_LIMITS)).toBe(false);
    expect(shouldAutoStop(15, PRODUCT_CLIP_LIMITS)).toBe(true);
  });
  it('rejects clips under 8 or over 15 seconds', () => {
    expect(validateVideo(ok, PRODUCT_CLIP_LIMITS)).toBeNull();
    expect(validateVideo({ ...ok, durationSec: 6 }, PRODUCT_CLIP_LIMITS)).toMatch(/at least 8 seconds/);
    expect(validateVideo({ ...ok, durationSec: 20 }, PRODUCT_CLIP_LIMITS)).toMatch(/15 seconds or less/);
  });
});

describe('every video needs approval before customers see it', () => {
  it('a product clip only counts as live once approved', () => {
    expect(clipReviewState({ status: 'pending' })).toBe('review');
    expect(clipReviewState({ status: 'rejected' })).toBe('rejected');
    expect(clipReviewState({ status: 'live' })).toBe('live');
  });
  it('a product with a pending clip still shows its photo, not the clip', () => {
    expect(productReelStatus(product, { status: 'pending' }).media).toBe('photo');
    expect(productReelStatus(product, { status: 'live' }).media).toBe('video');
  });
  it('a shop intro waiting for review is not live', () => {
    const ready = { video_status: 'ready', video_updated_at: new Date(NOW).toISOString() };
    expect(introReviewState({ ...ready, video_review_status: 'pending' }, NOW)).toBe('review');
    expect(introReviewState({ ...ready, video_review_status: 'approved' }, NOW)).toBe('live');
    expect(introReviewState({ ...ready, video_review_status: 'rejected' }, NOW)).toBe('rejected');
  });
  it('tells the merchant how to fix a rejected video', () => {
    expect(rejectFix('too_dark')).toBe('Too dark. Record somewhere brighter.');
    expect(rejectFix(null)).toBe('Not approved. Please record a new one.');
  });
});

describe('videos come first, photos still allowed', () => {
  it('a photo-only product stays in the reel as a photo slide', () => {
    expect(reelMediaKind(item('a'))).toBe('photo');
    expect(isReelEligible(item('a'))).toBe(true);
  });
  it('a product with an approved clip but no photo can still appear', () => {
    expect(isReelEligible(item('a', { imageUrl: null, clipUrl: 'https://x/a.mp4' }))).toBe(true);
  });
  it('puts video products ahead of newer photo products', () => {
    const older = new Date(NOW - 5 * 86_400_000).toISOString();
    const items = [item('photo'), item('video', { clipUrl: 'https://x/v.mp4', createdAt: older })];
    expect(rankGlobalFeed(items, null, NOW).map(i => i.id)).toEqual(['video', 'photo']);
    expect(rankShopReel(items).map(i => i.id)).toEqual(['video', 'photo']);
  });
  it('leaves out products the merchant hid from the reel', () => {
    expect(isReelEligible(item('a', { reelHidden: true }))).toBe(false);
    expect(productReelStatus({ ...product, reel_hidden: true }, null).hidden).toBe('hidden');
  });
  it('nudges photo-only products to add a video', () => {
    expect(productReelStatus(product, null).nudge).toBe(true);
    expect(productReelStatus(product, { status: 'pending' }).nudge).toBe(false);
  });
});

describe('setup checklist', () => {
  it('needs an approved intro, 3 reel-ready products and an open shop', () => {
    const ready = productReelStatus(product, null);
    const list = setupChecklist({ intro: 'review', isOpen: true, products: [ready, ready, ready] });
    expect(list.find(i => i.key === 'intro')?.done).toBe(false);
    expect(list.find(i => i.key === 'reels')?.done).toBe(true);
    expect(setupChecklist({ intro: 'live', isOpen: true, products: [ready, ready] }).find(i => i.key === 'reels')?.done).toBe(false);
  });
});
