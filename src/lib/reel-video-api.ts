// Browser data access for product reel videos and the admin review queue.
// The new tables and functions are reached untyped until the backend types refresh.
import { Upload } from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import { clipVersion, productClipPaths, videoExtension } from '@/lib/merchant-video';
import { BUCKET, CHUNK, friendly, publicUrl, publishableKey, storageOrigin, type UploadHandle, type UploadProgress } from '@/lib/merchant-video-api';
import type { RejectReason } from '@/lib/reel-video';
import { approveShopVideosAndNotify, reviewVideoAndNotify } from '@/lib/video-review.functions';

type DbError = { message: string; code?: string } | null;
type DbResult<T> = { data: T | null; error: DbError };
type Query<T> = PromiseLike<DbResult<T>> & {
  select: (cols?: string) => Query<T>;
  eq: (col: string, v: unknown) => Query<T>;
  in: (col: string, v: unknown[]) => Query<T>;
  order: (col: string, o?: { ascending?: boolean }) => Query<T>;
  limit: (n: number) => Query<T>;
};
const db = supabase as unknown as {
  from: <T>(table: string) => Query<T>;
  rpc: <T>(fn: string, args?: Record<string, unknown>) => PromiseLike<DbResult<T>>;
};

/** The saved-data changes for reel videos are not applied yet on this backend. */
export const isMissingFeature = (error: DbError) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' || error.code === '42883' || /does not exist|could not find/i.test(error.message));

export type ProductClip = {
  product_id: string; merchant_id: string; video_url: string; thumb_url: string; video_path: string; thumb_path: string;
  duration_sec: number | string; size_bytes: number | string; status: 'processing' | 'live' | 'rejected';
  reject_reason: string | null; reviewed_at: string | null; submitted_at: string;
};

/** A merchant's product clips (any status). `available` is false until the backend is updated. */
export async function loadMyProductClips(merchantId: string): Promise<{ available: boolean; clips: Map<string, ProductClip> }> {
  const { data, error } = await db.from<ProductClip[]>('product_reel_videos').select('*').eq('merchant_id', merchantId);
  if (isMissingFeature(error)) return { available: false, clips: new Map() };
  if (error) throw new Error('Your reel videos could not be loaded. Please try again.');
  return { available: true, clips: new Map((data ?? []).map(c => [c.product_id, c])) };
}

/** Uploads a product clip (thumbnail first, then the video in resumable chunks) and sends it to review. */
export function uploadProductClip(input: {
  merchantId: string; productId: string; video: Blob; mimeType: string; durationSec: number; thumb: Blob;
  onProgress: (p: UploadProgress) => void; onStage: (stage: 'uploading' | 'processing') => void;
}): UploadHandle {
  const ext = videoExtension(input.mimeType);
  if (!ext) throw new Error('Please use an MP4 or WebM video.');
  const paths = productClipPaths(input.merchantId, input.productId, clipVersion(input.video.size, input.durationSec), ext);
  let upload: Upload | null = null;
  let cancelled = false;

  const done = (async () => {
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    if (!token) throw new Error('Please sign in again to upload your video.');
    input.onStage('uploading');
    const thumbResult = await supabase.storage.from(BUCKET).upload(paths.thumb, input.thumb, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (thumbResult.error) throw new Error(friendly(thumbResult.error));
    await new Promise<void>((resolve, reject) => {
      upload = new Upload(input.video, {
        endpoint: `${storageOrigin()}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
        chunkSize: CHUNK,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { authorization: `Bearer ${token}`, apikey: publishableKey(), 'x-upsert': 'true' },
        metadata: { bucketName: BUCKET, objectName: paths.video, contentType: input.mimeType, cacheControl: '3600' },
        onProgress: (sent, total) => input.onProgress({ sent, total }),
        onSuccess: () => resolve(),
        onError: (err) => reject(new Error(friendly(err))),
      });
      upload.findPreviousUploads().then(previous => {
        if (previous.length) upload!.resumeFromPreviousUpload(previous[0]!);
        if (!cancelled) upload!.start();
      }, () => upload!.start());
    });
    input.onStage('processing');
    const { data, error } = await db.rpc<{ old_path?: string | null; old_thumb_path?: string | null }>('merchant_reel_video_publish', {
      _product_id: input.productId,
      _path: paths.video,
      _thumb_path: paths.thumb,
      _video_url: publicUrl(paths.video),
      _thumb_url: publicUrl(paths.thumb),
      _duration: Math.round(input.durationSec * 100) / 100,
    });
    if (isMissingFeature(error)) throw new Error('Product videos are not switched on yet. Your video is saved on this phone.');
    if (error) throw new Error(error.message || 'Your video could not be sent. Please try again.');
    const stale = [data?.old_path, data?.old_thumb_path].filter((p): p is string => !!p);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
  })();

  return {
    done,
    cancel: async () => {
      cancelled = true;
      if (upload) await (upload as Upload).abort(true).catch(() => undefined);
    },
  };
}

export async function removeProductClip(productId: string) {
  const { data, error } = await db.rpc<{ old_path?: string | null; old_thumb_path?: string | null }>('merchant_reel_video_remove', { _product_id: productId });
  if (error) throw new Error('The video could not be deleted. Please try again.');
  const paths = [data?.old_path, data?.old_thumb_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function setReelHidden(productId: string, hidden: boolean) {
  const { error } = await db.rpc('merchant_reel_set_hidden', { _product_id: productId, _hidden: hidden });
  if (error) throw new Error(isMissingFeature(error) ? 'Hiding from the reel is not switched on yet.' : 'Could not save. Please try again.');
}

export async function saveReelOrder(productIds: string[]) {
  const { error } = await db.rpc('merchant_reel_reorder', { _product_ids: productIds });
  if (error) throw new Error(isMissingFeature(error) ? 'Reordering is not switched on yet.' : 'The new order could not be saved. Please try again.');
}

// ---- Admin review -----------------------------------------------------------

export type ReviewItem = {
  kind: 'intro' | 'product';
  /** Merchant id for intros, product id for product clips. */
  target: string;
  merchantId: string;
  shopName: string;
  productName: string | null;
  videoUrl: string;
  thumbUrl: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  submittedAt: string;
};

export type ReviewLogRow = {
  id: string; merchant_id: string; product_id: string | null; kind: 'intro' | 'product';
  decision: 'submitted' | 'live' | 'rejected'; reason: string | null; actor_id: string | null; created_at: string;
};

const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Every video waiting for review, oldest first. */
export async function loadReviewQueue(): Promise<{ available: boolean; items: ReviewItem[] }> {
  type IntroRow = { id: string; name: string; video_url: string | null; video_thumb_url: string | null; video_duration: unknown; video_size_bytes: unknown; video_updated_at: string | null };
  type ClipRow = ProductClip & { product: { name: string } | null; merchant: { name: string } | null };
  const [intros, clips] = await Promise.all([
    db.from<IntroRow[]>('merchants').select('id, name, video_url, video_thumb_url, video_duration, video_size_bytes, video_updated_at')
      .eq('video_status', 'ready').eq('video_review_status', 'pending'),
    db.from<ClipRow[]>('product_reel_videos').select('*, product:products(name), merchant:merchants(name)').eq('status', 'processing'),
  ]);
  if (intros.error) throw new Error('The review queue could not be loaded.');
  const items: ReviewItem[] = (intros.data ?? []).filter(m => m.video_url).map(m => ({
    kind: 'intro', target: m.id, merchantId: m.id, shopName: m.name, productName: null,
    videoUrl: m.video_url!, thumbUrl: m.video_thumb_url, durationSec: num(m.video_duration), sizeBytes: num(m.video_size_bytes),
    submittedAt: m.video_updated_at ?? '',
  }));
  const available = !isMissingFeature(clips.error);
  if (clips.error && available) throw new Error('The review queue could not be loaded.');
  for (const c of clips.data ?? []) {
    items.push({
      kind: 'product', target: c.product_id, merchantId: c.merchant_id, shopName: c.merchant?.name ?? 'Shop',
      productName: c.product?.name ?? 'Product', videoUrl: c.video_url, thumbUrl: c.thumb_url,
      durationSec: num(c.duration_sec), sizeBytes: num(c.size_bytes), submittedAt: c.submitted_at,
    });
  }
  items.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  return { available, items };
}

/** Approve or reject one video; the server then texts the merchant. */
export async function reviewVideo(item: Pick<ReviewItem, 'kind' | 'target'>, decision: 'live' | 'rejected', reason?: RejectReason) {
  return reviewVideoAndNotify({ data: { kind: item.kind, target: item.target, decision, ...(reason ? { reason } : {}) } });
}

/** Approve everything waiting from one shop; the merchant gets one text. */
export async function approveShopVideos(merchantId: string): Promise<number> {
  const result = await approveShopVideosAndNotify({ data: { merchantId } });
  return result.count;
}

export async function loadReviewLog(limit = 50): Promise<ReviewLogRow[]> {
  const { data, error } = await db.from<ReviewLogRow[]>('video_review_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (isMissingFeature(error)) return [];
  if (error) throw new Error('The review history could not be loaded.');
  return data ?? [];
}
