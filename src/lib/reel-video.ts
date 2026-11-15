// Pure rules for merchant reel videos: review status, what each product shows
// in the reel, the setup checklist, and reel order. No network or browser here.
import { effectiveVideoStatus } from '@/lib/merchant-video';

/** Reasons an admin can give when rejecting; merchants see the one-line fix. */
export const REJECT_REASONS = {
  blurry: { label: 'Blurry', fix: 'Blurry. Hold the phone still and record again.' },
  too_dark: { label: 'Too dark', fix: 'Too dark. Record somewhere brighter.' },
  not_the_product: { label: "Doesn't show the product", fix: "We couldn't see the product. Hold it up to the camera." },
  inappropriate: { label: 'Inappropriate', fix: 'This video is not allowed on Beez. Please record a new one.' },
  wrong_length: { label: 'Wrong length', fix: 'Wrong length. Product videos are 8–15 seconds, shop intros 15–30.' },
} as const;
export type RejectReason = keyof typeof REJECT_REASONS;
export const REJECT_REASON_KEYS = Object.keys(REJECT_REASONS) as RejectReason[];

export function rejectFix(reason: string | null | undefined): string {
  return reason && reason in REJECT_REASONS ? REJECT_REASONS[reason as RejectReason].fix : 'Not approved. Please record a new one.';
}

export const UNDER_REVIEW_NOTE = 'Under review, usually within a few hours';

/** What the merchant sees for a video. Only "live" reaches customers. */
export type ReviewState = 'none' | 'uploading' | 'failed' | 'review' | 'live' | 'rejected';

export function introReviewState(m: {
  video_status?: string | null; video_review_status?: string | null; video_updated_at?: string | null;
}, now = Date.now()): ReviewState {
  const status = effectiveVideoStatus(m.video_status, m.video_updated_at, now);
  if (status === 'none') return 'none';
  if (status === 'failed') return 'failed';
  if (status !== 'ready') return 'uploading';
  if (m.video_review_status === 'approved') return 'live';
  if (m.video_review_status === 'rejected') return 'rejected';
  return 'review';
}

export function clipReviewState(clip: { status?: string | null } | null | undefined): ReviewState {
  if (!clip) return 'none';
  if (clip.status === 'live') return 'live';
  if (clip.status === 'rejected') return 'rejected';
  return 'review';
}

export type ReelProductInput = {
  id: string; active: boolean; stock: number; image_url: string | null;
  reel_hidden?: boolean | null; reel_position?: number | null; created_at?: string;
};

export type ProductReelStatus = {
  /** What customers see right now: an approved video, the photo, or nothing. */
  media: 'video' | 'photo' | 'none';
  clip: ReviewState;
  /** Counts toward the checklist: has a live video or a photo. */
  reelReady: boolean;
  /** Why it isn't in the reel right now, if it isn't. */
  hidden: 'hidden' | 'out_of_stock' | 'inactive' | 'no_media' | null;
  /** Photo-only products are nudged to add a clip. */
  nudge: boolean;
};

export function productReelStatus(product: ReelProductInput, clip: { status?: string | null } | null | undefined): ProductReelStatus {
  const state = clipReviewState(clip);
  const media = state === 'live' ? 'video' : product.image_url ? 'photo' : 'none';
  const hidden = !product.active ? 'inactive'
    : product.reel_hidden ? 'hidden'
      : media === 'none' ? 'no_media'
        : product.stock <= 0 ? 'out_of_stock'
          : null;
  return { media, clip: state, reelReady: media !== 'none', hidden, nudge: media === 'photo' && state === 'none' };
}

export const MIN_REEL_PRODUCTS = 3;

export type ChecklistItem = { key: 'intro' | 'reels' | 'open'; label: string; done: boolean; detail: string };

/** Setup checklist: shop intro, 3 reel-ready products (video counts double), shop open. */
export function setupChecklist(input: { intro: ReviewState; isOpen: boolean; products: ProductReelStatus[] }): ChecklistItem[] {
  const live = input.products.filter(p => p.reelReady && p.hidden !== 'inactive');
  const videos = live.filter(p => p.media === 'video').length;
  const introDetail: Record<ReviewState, string> = {
    none: 'Not recorded yet', uploading: 'Uploading…', failed: 'Upload failed, try again',
    review: UNDER_REVIEW_NOTE, live: 'Live', rejected: 'Not approved, record a new one',
  };
  return [
    { key: 'intro', label: 'Shop intro video', done: input.intro === 'live', detail: introDetail[input.intro] },
    {
      key: 'reels', label: `${MIN_REEL_PRODUCTS} product reels`, done: live.length >= MIN_REEL_PRODUCTS,
      detail: `${Math.min(live.length, MIN_REEL_PRODUCTS)} of ${MIN_REEL_PRODUCTS} ready · ${videos} with video`,
    },
    { key: 'open', label: 'Shop open', done: input.isOpen, detail: input.isOpen ? 'Open for orders' : 'Closed' },
  ];
}

/** Reel manager order: the merchant's pinned order first, then videos, then newest. */
export function sortForReelManager<T extends ReelProductInput>(products: T[], clips: Map<string, { status?: string | null }>): T[] {
  const pos = (p: T) => p.reel_position ?? Number.MAX_SAFE_INTEGER;
  const vid = (p: T) => Number(clipReviewState(clips.get(p.id)) === 'live');
  return [...products].sort((a, b) =>
    pos(a) - pos(b) || vid(b) - vid(a) || (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.id.localeCompare(b.id));
}

/** Moves one id up or down; the result becomes the saved pinned order. */
export function moveInOrder(ids: string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
