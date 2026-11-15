// Uploading and managing a merchant's intro video. Uploads are resumable
// (tus), so a dropped connection continues where it stopped.
import { Upload } from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import { videoExtension, videoPaths } from '@/lib/merchant-video';

export const BUCKET = 'videos';
export const CHUNK = 6 * 1024 * 1024; // required chunk size for resumable storage uploads

export function storageOrigin() {
  return new URL(supabase.storage.from(BUCKET).getPublicUrl('x').data.publicUrl).origin;
}
export function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
export function publishableKey(): string {
  return (supabase as unknown as { supabaseKey: string }).supabaseKey;
}

export type UploadProgress = { sent: number; total: number };
export type UploadHandle = { done: Promise<void>; cancel: () => Promise<void> };

export function friendly(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (/413|too large|exceeded/i.test(text)) return 'This video is too large. Please keep it under 50 MB.';
  if (/storage.*full|quota/i.test(text)) return 'Storage is full right now. Save the video on this phone and try again later.';
  if (/401|403|jwt|auth/i.test(text)) return 'Please sign in again to upload your video.';
  if (/network|failed to fetch|offline|timeout/i.test(text) || !navigator.onLine) return 'Your connection dropped. Tap Retry and the upload will continue where it stopped.';
  return 'The upload did not finish. Tap Retry and it will continue where it stopped.';
}

/**
 * Uploads the intro (thumbnail first, then the video in resumable chunks)
 * and publishes it. Retrying with the same file resumes the earlier upload.
 */
export function uploadIntroVideo(input: {
  merchantId: string;
  video: Blob;
  mimeType: string;
  durationSec: number;
  thumb: Blob;
  onProgress: (p: UploadProgress) => void;
  onStage: (stage: 'uploading' | 'processing') => void;
}): UploadHandle {
  const ext = videoExtension(input.mimeType);
  if (!ext) throw new Error('Please use an MP4 or WebM video.');
  // Same file → same version, so a retry resumes rather than restarts.
  const version = `${input.video.size.toString(36)}-${Math.round(input.durationSec * 100).toString(36)}`;
  const paths = videoPaths(input.merchantId, version, ext);
  let upload: Upload | null = null;
  let cancelled = false;

  const done = (async () => {
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    if (!token) throw new Error('Please sign in again to upload your video.');
    input.onStage('uploading');
    await supabase.rpc('merchant_video_set_status', { _status: 'uploading' });

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
    await supabase.rpc('merchant_video_set_status', { _status: 'processing' });
    const { data, error } = await supabase.rpc('merchant_video_publish', {
      _path: paths.video,
      _thumb_path: paths.thumb,
      _video_url: publicUrl(paths.video),
      _thumb_url: publicUrl(paths.thumb),
      _duration: Math.round(input.durationSec * 100) / 100,
    });
    if (error) throw new Error(error.message || 'Your video could not be published. Please try again.');
    // Replacing deletes the previous files.
    const old = (data ?? {}) as { old_path?: string | null; old_thumb_path?: string | null };
    const stale = [old.old_path, old.old_thumb_path].filter((p): p is string => !!p);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
  })().catch(async (err) => {
    if (!cancelled) await supabase.rpc('merchant_video_set_status', { _status: 'failed' });
    throw err;
  });

  return {
    done,
    cancel: async () => {
      cancelled = true;
      if (upload) await (upload as Upload).abort(true).catch(() => undefined);
      // Put back the earlier live video if there was one (otherwise none).
      await supabase.rpc('merchant_video_set_status', { _status: 'ready' });
    },
  };
}

export async function removeIntroVideo() {
  const { data, error } = await supabase.rpc('merchant_video_remove');
  if (error) throw new Error('The video could not be deleted. Please try again.');
  const old = (data ?? {}) as { old_path?: string | null; old_thumb_path?: string | null };
  const paths = [old.old_path, old.old_thumb_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function setShopOpen(merchantId: string, isOpen: boolean) {
  const { error } = await supabase.from('merchants').update({ is_open: isOpen }).eq('id', merchantId);
  if (error) throw new Error('Your shop status could not be saved. Please try again.');
}

export async function loadMyShop() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('merchants').select('*').eq('owner_id', auth.user.id).maybeSingle();
  if (error) throw new Error('Your shop could not be loaded. Please try again.');
  return data;
}
