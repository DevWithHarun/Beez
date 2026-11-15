// Browser-only helpers for intro videos: reading clip details, grabbing a
// thumbnail frame, and shrinking big gallery clips to about 480p on the phone.
import { VIDEO_BITRATE, VIDEO_TARGET_HEIGHT, pickRecorderMime } from '@/lib/merchant-video';

export type VideoMeta = { durationSec: number; width: number; height: number };

function loadVideo(src: Blob): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('We could not read this video. Please try another one.')); };
    video.src = url;
  });
}

/** Duration and size of a clip. Handles recorder files that report an unknown length. */
export async function readVideoMeta(src: Blob): Promise<VideoMeta> {
  const { video, url } = await loadVideo(src);
  try {
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      duration = await new Promise<number>((resolve) => {
        video.ontimeupdate = () => { video.ontimeupdate = null; resolve(video.duration); };
        video.currentTime = 1e7;
      });
    }
    return { durationSec: duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the current frame of a playing <video> into a small JPEG. */
export function grabFrame(video: HTMLVideoElement, maxWidth = 480): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return Promise.resolve(null);
  const scale = Math.min(1, maxWidth / w);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.8));
}

/** Thumbnail from a saved clip at about 1 second in. */
export async function thumbnailFromVideo(src: Blob, atSec = 1): Promise<Blob | null> {
  const { video, url } = await loadVideo(src);
  try {
    video.preload = 'auto';
    const target = Number.isFinite(video.duration) ? Math.min(atSec, video.duration / 2) : atSec;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onseeked = done;
      window.setTimeout(done, 4000);
      video.currentTime = target;
    });
    return await grabFrame(video);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type CaptureCanvas = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };

export function canRecordInBrowser() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
    && !!pickRecorderMime(m => MediaRecorder.isTypeSupported(m));
}

export function canShrinkOnPhone() {
  if (typeof window === 'undefined' || !('MediaRecorder' in window)) return false;
  const canvas = document.createElement('canvas') as CaptureCanvas;
  return typeof canvas.captureStream === 'function' && !!pickRecorderMime(m => MediaRecorder.isTypeSupported(m));
}

/**
 * Re-records a gallery clip at about 480p / 1 Mbps by playing it into a
 * canvas. Takes as long as the clip itself (at most 30 seconds).
 */
export async function shrinkVideo(src: Blob, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<{ blob: Blob; mimeType: string }> {
  const mimeType = pickRecorderMime(m => MediaRecorder.isTypeSupported(m));
  if (!mimeType) throw new Error('This phone cannot prepare videos. Please record your video here instead.');
  const { video, url } = await loadVideo(src);
  const audioContext = new AudioContext();
  try {
    video.muted = false;
    video.preload = 'auto';
    const scale = Math.min(1, VIDEO_TARGET_HEIGHT / Math.min(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas') as CaptureCanvas;
    canvas.width = Math.round((video.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((video.videoHeight * scale) / 2) * 2;
    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream!(24);
    // Route the clip's sound into the recording without playing it out loud.
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    destination.stream.getAudioTracks().forEach(t => stream.addTrack(t));

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: 64_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const finished = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

    let frame = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (video.duration) onProgress(Math.min(1, video.currentTime / video.duration));
      if (!video.ended && !signal.aborted) frame = requestAnimationFrame(draw);
    };
    const abort = () => { video.pause(); if (recorder.state !== 'inactive') recorder.stop(); };
    signal.addEventListener('abort', abort, { once: true });
    video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };

    recorder.start(1000);
    await video.play();
    frame = requestAnimationFrame(draw);
    await finished;
    cancelAnimationFrame(frame);
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    onProgress(1);
    const base = mimeType.split(';')[0]!;
    return { blob: new Blob(chunks, { type: base }), mimeType: base };
  } finally {
    URL.revokeObjectURL(url);
    void audioContext.close();
  }
}
