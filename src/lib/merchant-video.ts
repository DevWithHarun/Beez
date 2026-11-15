// Pure rules for merchant intro videos (recording limits, validation, paths).
export const VIDEO_MIN_SEC = 15;
export const VIDEO_MAX_SEC = 30;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** Gallery clips bigger than this (or taller than 540p) are shrunk on the phone first. */
export const VIDEO_TARGET_BYTES = 8 * 1024 * 1024;
export const VIDEO_TARGET_HEIGHT = 480;
export const VIDEO_BITRATE = 1_000_000;
/** An upload that has been "uploading" this long was abandoned. */
export const STALE_UPLOAD_MS = 15 * 60 * 1000;
export const ACCEPTED_TYPES = ['video/mp4', 'video/webm'] as const;

export type VideoStatus = 'none' | 'uploading' | 'processing' | 'ready' | 'failed';

/** Recording limits: shop intro 15–30 s, product reel clip 8–15 s. */
export type ClipLimits = { minSec: number; maxSec: number; maxBytes: number; sizeLabel: string };
export const INTRO_LIMITS: ClipLimits = { minSec: VIDEO_MIN_SEC, maxSec: VIDEO_MAX_SEC, maxBytes: VIDEO_MAX_BYTES, sizeLabel: '50 MB' };
export const PRODUCT_CLIP_LIMITS: ClipLimits = { minSec: 8, maxSec: 15, maxBytes: 20 * 1024 * 1024, sizeLabel: '20 MB' };

export function canStopRecording(elapsedSec: number, limits: ClipLimits = INTRO_LIMITS) {
  return elapsedSec >= limits.minSec;
}
export function shouldAutoStop(elapsedSec: number, limits: ClipLimits = INTRO_LIMITS) {
  return elapsedSec >= limits.maxSec;
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Container type without codec details, e.g. "video/webm;codecs=vp8" -> "video/webm". */
export function baseMime(mime: string) {
  return mime.split(';')[0]!.trim().toLowerCase();
}

export function videoExtension(mime: string): 'mp4' | 'webm' | null {
  const base = baseMime(mime);
  return base === 'video/mp4' ? 'mp4' : base === 'video/webm' ? 'webm' : null;
}

/** Plain-language reason a clip can't be used, or null when it's fine. */
export function validateVideo(input: { durationSec: number; sizeBytes: number; mimeType: string }, limits: ClipLimits = INTRO_LIMITS): string | null {
  if (!videoExtension(input.mimeType)) return 'Please use an MP4 or WebM video.';
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) return 'We could not read this video. Please try another one.';
  if (input.durationSec < limits.minSec - 0.5) return `Video too short, please record at least ${limits.minSec} seconds.`;
  if (input.durationSec > limits.maxSec + 0.5) return `Video too long, please keep it to ${limits.maxSec} seconds or less.`;
  if (input.sizeBytes > limits.maxBytes) return `This video is too large. Please keep it under ${limits.sizeLabel}.`;
  if (input.sizeBytes <= 0) return 'This video is empty. Please record again.';
  return null;
}

/** Gallery picks: duration rules apply before any shrinking. */
export function validateGalleryPick(input: { durationSec: number; sizeBytes: number }, limits: ClipLimits = INTRO_LIMITS): string | null {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) return 'We could not read this video. Please try another one.';
  if (input.durationSec < limits.minSec - 0.5) return `Video too short, please pick one that is at least ${limits.minSec} seconds.`;
  if (input.durationSec > limits.maxSec + 0.5) return `Video too long, please pick one that is ${limits.maxSec} seconds or less.`;
  // Big gallery files are shrunk before upload, so only the intro's hard cap applies here.
  if (input.sizeBytes > VIDEO_MAX_BYTES) return 'This video is too large. Please keep it under 50 MB.';
  return null;
}

/** Big or high-resolution gallery clips are shrunk to about 480p before upload. */
export function needsShrinking(input: { width: number; height: number; sizeBytes: number; mimeType: string }) {
  return !videoExtension(input.mimeType) || input.sizeBytes > VIDEO_TARGET_BYTES || Math.min(input.width, input.height) > 540;
}

/** Recorder format preference: MP4 where the phone supports it, else WebM. */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  const options = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find(m => isSupported(m)) ?? null;
}

export function videoPaths(merchantId: string, version: string, ext: 'mp4' | 'webm') {
  return { video: `${merchantId}/intro-${version}.${ext}`, thumb: `${merchantId}/intro-${version}.jpg` };
}

/** Product reel clip files live in the shop's folder under products/. */
export function productClipPaths(merchantId: string, productId: string, version: string, ext: 'mp4' | 'webm') {
  const base = `${merchantId}/products/${productId}-${version}`;
  return { video: `${base}.${ext}`, thumb: `${base}.jpg` };
}

/** Same file → same version, so a retry resumes rather than restarts. */
export function clipVersion(sizeBytes: number, durationSec: number) {
  return `${sizeBytes.toString(36)}-${Math.round(durationSec * 100).toString(36)}`;
}

/** What My Store should show, treating long-abandoned uploads as failed. */
export function effectiveVideoStatus(status: string | null | undefined, updatedAt: string | null | undefined, now = Date.now()): VideoStatus {
  const s = (status ?? 'none') as VideoStatus;
  if ((s === 'uploading' || s === 'processing') && updatedAt && now - Date.parse(updatedAt) > STALE_UPLOAD_MS) return 'failed';
  return ['none', 'uploading', 'processing', 'ready', 'failed'].includes(s) ? s : 'none';
}
