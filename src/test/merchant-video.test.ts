import { describe, expect, it } from 'vitest';
import { canStopRecording, effectiveVideoStatus, needsShrinking, pickRecorderMime, shouldAutoStop, validateGalleryPick, validateVideo, videoPaths } from '@/lib/merchant-video';

describe('recording limits', () => {
  it('only allows stopping from 15 seconds and auto-stops at 30', () => {
    expect(canStopRecording(14.9)).toBe(false);
    expect(canStopRecording(15)).toBe(true);
    expect(shouldAutoStop(29.9)).toBe(false);
    expect(shouldAutoStop(30)).toBe(true);
  });
});

describe('video validation', () => {
  const ok = { durationSec: 20, sizeBytes: 4_000_000, mimeType: 'video/webm;codecs=vp8' };
  it('accepts a 15-30 second mp4 or webm under 50 MB', () => {
    expect(validateVideo(ok)).toBeNull();
    expect(validateVideo({ ...ok, mimeType: 'video/mp4' })).toBeNull();
  });
  it('explains short, long, large and wrong-format videos plainly', () => {
    expect(validateVideo({ ...ok, durationSec: 10 })).toBe('Video too short, please record at least 15 seconds.');
    expect(validateVideo({ ...ok, durationSec: 45 })).toMatch(/too long/);
    expect(validateVideo({ ...ok, sizeBytes: 51 * 1024 * 1024 })).toMatch(/50 MB/);
    expect(validateVideo({ ...ok, mimeType: 'video/quicktime' })).toMatch(/MP4 or WebM/);
  });
  it('checks gallery picks for 15-30 s and 50 MB before shrinking', () => {
    expect(validateGalleryPick({ durationSec: 12, sizeBytes: 1 })).toMatch(/too short/);
    expect(validateGalleryPick({ durationSec: 20, sizeBytes: 60 * 1024 * 1024 })).toMatch(/50 MB/);
    expect(validateGalleryPick({ durationSec: 20, sizeBytes: 9_000_000 })).toBeNull();
  });
  it('shrinks big or high-resolution gallery clips', () => {
    expect(needsShrinking({ width: 1080, height: 1920, sizeBytes: 5_000_000, mimeType: 'video/mp4' })).toBe(true);
    expect(needsShrinking({ width: 480, height: 854, sizeBytes: 4_000_000, mimeType: 'video/mp4' })).toBe(false);
    expect(needsShrinking({ width: 480, height: 854, sizeBytes: 4_000_000, mimeType: 'video/quicktime' })).toBe(true);
  });
});

describe('video files and status', () => {
  it('stores the intro and its thumbnail in the merchant folder', () => {
    expect(videoPaths('m1', 'abc', 'webm')).toEqual({ video: 'm1/intro-abc.webm', thumb: 'm1/intro-abc.jpg' });
  });
  it('prefers mp4 recording when the phone supports it', () => {
    expect(pickRecorderMime(m => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecorderMime(m => m === 'video/mp4')).toBe('video/mp4');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
  it('treats uploads stuck for over 15 minutes as failed', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(effectiveVideoStatus('uploading', '2026-11-14T11:40:00Z', now)).toBe('failed');
    expect(effectiveVideoStatus('uploading', '2026-11-14T11:55:00Z', now)).toBe('uploading');
    expect(effectiveVideoStatus(undefined, null, now)).toBe('none');
  });
});
