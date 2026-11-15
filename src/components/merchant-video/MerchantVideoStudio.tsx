import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  X, RefreshCcw, Camera, Upload as UploadIcon, Loader2, CheckCircle2, AlertTriangle, RotateCcw, Smartphone, Video, Save, Trash2, Lightbulb,
  Mic, Keyboard, CloudOff,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  INTRO_LIMITS, PRODUCT_CLIP_LIMITS, VIDEO_BITRATE, baseMime, canStopRecording, formatClock, needsShrinking, pickRecorderMime,
  shouldAutoStop, validateGalleryPick, validateVideo, videoExtension,
} from '@/lib/merchant-video';
import { formatBytes } from '@/lib/reel-feed';
import { canRecordInBrowser, canShrinkOnPhone, grabFrame, readVideoMeta, shrinkVideo, thumbnailFromVideo } from '@/lib/video-capture';
import {
  clearSavedVideo, listQueuedClips, newProductQueueKey, productQueueKey, removeQueuedClip, saveQueuedClip, saveVideoLocally,
  type DraftProduct, type QueuedClip, type SavedVideo,
} from '@/lib/video-local';
import { uploadIntroVideo, type UploadHandle } from '@/lib/merchant-video-api';
import { uploadProductClip } from '@/lib/reel-video-api';
import { UNDER_REVIEW_NOTE } from '@/lib/reel-video';
import { merchantQuery } from '@/lib/merchant-query';
import { saveMerchantProduct } from '@/lib/merchant.functions';
import { VoiceProductCreator } from '@/components/VoiceProductCreator';

type Shop = { id: string; name: string; slug: string | null; category?: string | null };
/** What the recording is for: the shop intro, a clip for an existing product, or a new product (video first). */
export type StudioTarget =
  | { kind: 'intro' }
  | { kind: 'product'; product: { id: string; name: string; price_kes: number; unit?: string | null } }
  | { kind: 'new-product' };
type Clip = { blob: Blob; mimeType: string; durationSec: number; thumb: Blob | null };
type Step =
  | 'home' | 'tips' | 'starting' | 'camera' | 'recording' | 'interrupted' | 'denied'
  | 'preparing' | 'review' | 'details' | 'uploading' | 'failed' | 'queued' | 'done';

const kes = (n: number) => `KSh ${n.toLocaleString('en-KE')}`;

export function MerchantVideoStudio({ shop, start, target = { kind: 'intro' } }: { shop: Shop; start?: 'record' | 'upload' | undefined; target?: StudioTarget }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isIntro = target.kind === 'intro';
  const limits = isIntro ? INTRO_LIMITS : PRODUCT_CLIP_LIMITS;
  const [step, setStep] = useState<Step>(start === 'record' ? 'tips' : 'home');
  /** Product being filmed; set once a new product has been created. */
  const [product, setProduct] = useState<{ id: string; name: string; price_kes: number; unit?: string | null } | null>(target.kind === 'product' ? target.product : null);
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [typed, setTyped] = useState({ name: '', price: '', stock: '', category: shop.category ?? '' });
  const [creating, setCreating] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [stage, setStage] = useState<'uploading' | 'processing'>('uploading');
  const [saved, setSaved] = useState<SavedVideo | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deniedReason, setDeniedReason] = useState<'denied' | 'nocamera' | 'unsupported'>('denied');
  const [recordSupported, setRecordSupported] = useState(true);

  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const thumb = useRef<Blob | null>(null);
  const thumbRequested = useRef(false);
  const discarding = useRef(false);
  const timer = useRef<{ startedAt: number; carried: number; interval: number | null }>({ startedAt: 0, carried: 0, interval: null });
  const upload = useRef<UploadHandle | null>(null);
  const prepareAbort = useRef<AbortController | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecordSupported(canRecordInBrowser());
    // A clip for this same target that is still waiting on this phone.
    void listQueuedClips().then(list => {
      const key = target.kind === 'intro' ? 'intro' : target.kind === 'product' ? productQueueKey(target.product.id) : null;
      setSaved(key ? list.find(c => c.key === key) ?? null : null);
    });
    return () => { stopCamera(); prepareAbort.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Camera ---------------------------------------------------------------
  function stopCamera() {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    if (timer.current.interval) window.clearInterval(timer.current.interval);
  }

  async function openCamera(nextFacing = facing) {
    if (!canRecordInBrowser()) { setDeniedReason('unsupported'); setStep('denied'); return; }
    setStep('starting');
    stopCamera();
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      setFacing(nextFacing);
      setStep('camera');
      requestAnimationFrame(() => {
        if (preview.current) { preview.current.srcObject = media; void preview.current.play().catch(() => undefined); }
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      setDeniedReason(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'denied');
      setStep('denied');
    }
  }

  const flip = () => void openCamera(facing === 'environment' ? 'user' : 'environment');

  // ---- Recording ------------------------------------------------------------
  function tick() {
    const t = timer.current;
    const now = t.carried + (performance.now() - t.startedAt) / 1000;
    setElapsed(now);
    // Thumbnail: a frame from about 1 second in.
    if (now >= 1 && !thumbRequested.current && preview.current) {
      thumbRequested.current = true;
      void grabFrame(preview.current).then(b => { thumb.current = b; });
    }
    if (shouldAutoStop(now, limits)) stopRecording();
  }

  function startRecording() {
    const media = stream.current;
    if (!media) return;
    const mimeType = pickRecorderMime(m => MediaRecorder.isTypeSupported(m));
    if (!mimeType) { setDeniedReason('unsupported'); setStep('denied'); return; }
    chunks.current = [];
    thumb.current = null;
    thumbRequested.current = false;
    const rec = new MediaRecorder(media, { mimeType, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: 64_000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => void finishRecording(baseMime(rec.mimeType || mimeType));
    recorder.current = rec;
    rec.start(1000);
    timer.current = { startedAt: performance.now(), carried: 0, interval: window.setInterval(tick, 200) };
    setElapsed(0);
    setStep('recording');
  }

  function stopRecording() {
    const t = timer.current;
    if (t.interval) { window.clearInterval(t.interval); t.interval = null; }
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') {
      if (rec.state === 'recording') t.carried += (performance.now() - t.startedAt) / 1000;
      rec.stop();
    }
  }

  async function finishRecording(mimeType: string) {
    const durationSec = Math.min(limits.maxSec, timer.current.carried);
    const blob = new Blob(chunks.current, { type: mimeType });
    recorder.current = null;
    if (discarding.current) { discarding.current = false; return; }
    stopCamera();
    const frame = thumb.current ?? (await thumbnailFromVideo(blob));
    const problem = validateVideo({ durationSec, sizeBytes: blob.size, mimeType }, limits);
    setClip({ blob, mimeType, durationSec, thumb: frame });
    setError(problem);
    setStep('review');
  }

  // Leaving the app mid-recording: pause and offer Resume or Retake.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      const rec = recorder.current;
      if (rec?.state === 'recording') {
        rec.pause();
        const t = timer.current;
        t.carried += (performance.now() - t.startedAt) / 1000;
        if (t.interval) { window.clearInterval(t.interval); t.interval = null; }
        setElapsed(t.carried);
        setStep('interrupted');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const cameraAlive = () => !!stream.current?.getVideoTracks().some(t => t.readyState === 'live');

  function resumeRecording() {
    const rec = recorder.current;
    if (!rec || !cameraAlive()) return;
    rec.resume();
    timer.current.startedAt = performance.now();
    timer.current.interval = window.setInterval(tick, 200);
    setStep('recording');
  }

  function discardRecording() {
    discarding.current = true;
    const rec = recorder.current;
    if (timer.current.interval) window.clearInterval(timer.current.interval);
    if (rec && rec.state !== 'inactive') rec.stop(); else discarding.current = false;
    chunks.current = [];
    setElapsed(0);
  }

  function retake() {
    discardRecording();
    setClip(null);
    setError(null);
    void openCamera();
  }

  function cancel() {
    if (step === 'recording' || step === 'interrupted') { setConfirmCancel(true); return; }
    stopCamera();
    backToVideos();
  }

  // ---- Gallery / native capture ----------------------------------------------
  async function takeFile(file: File) {
    setError(null);
    setStep('preparing');
    setPrepareProgress(0);
    try {
      const meta = await readVideoMeta(file);
      const problem = validateGalleryPick({ durationSec: meta.durationSec, sizeBytes: file.size }, limits);
      if (problem) { setError(problem); setStep('home'); return; }
      let blob: Blob = file;
      let mimeType = baseMime(file.type || 'video/mp4');
      if (needsShrinking({ width: meta.width, height: meta.height, sizeBytes: file.size, mimeType })) {
        if (canShrinkOnPhone()) {
          prepareAbort.current = new AbortController();
          const small = await shrinkVideo(file, setPrepareProgress, prepareAbort.current.signal);
          // Keep the original if shrinking somehow made it bigger.
          if (small.blob.size < file.size || !videoExtension(mimeType)) { blob = small.blob; mimeType = small.mimeType; }
        } else if (!videoExtension(mimeType) || file.size > 20 * 1024 * 1024) {
          setError('This phone cannot shrink this video. Please record it here instead, or pick a smaller MP4 clip.');
          setStep('home');
          return;
        }
      }
      const frame = await thumbnailFromVideo(blob);
      setClip({ blob, mimeType, durationSec: Math.min(meta.durationSec, limits.maxSec), thumb: frame });
      setError(validateVideo({ durationSec: meta.durationSec, sizeBytes: blob.size, mimeType }, limits));
      setStep('review');
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') { setStep('home'); return; }
      setError(e instanceof Error ? e.message : 'We could not read this video. Please try another one.');
      setStep('home');
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void takeFile(file);
  };

  // ---- Upload ----------------------------------------------------------------
  /** "Use this video": a new product first asks for its details. */
  function chooseClip(target_: Clip) {
    if (target.kind === 'new-product' && !product) { setStep('details'); return; }
    void startUpload(target_);
  }

  async function ensureFrame(c: Clip) {
    const frame = c.thumb ?? (await thumbnailFromVideo(c.blob));
    if (frame) return frame;
    // A plain dark frame keeps the upload going if no frame could be read.
    return new Promise<Blob>((resolve) => {
      const canvas = document.createElement('canvas'); canvas.width = 270; canvas.height = 480;
      canvas.getContext('2d')!.fillRect(0, 0, 270, 480);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.7);
    });
  }

  /** Saves the clip in "Uploading later"; it uploads by itself once the phone is back online. */
  async function queueForLater(c: Clip, reason?: string) {
    const base = { blob: c.blob, mimeType: c.mimeType, durationSec: c.durationSec, thumb: c.thumb, savedAt: new Date().toISOString(), ...(reason ? { lastError: reason } : {}) };
    const entry: QueuedClip = isIntro
      ? { ...base, key: 'intro', kind: 'intro' }
      : product
        ? { ...base, key: productQueueKey(product.id), kind: 'product', productId: product.id, productName: product.name }
        : { ...base, key: newProductQueueKey(), kind: 'new-product', ...(draft ? { draft, productName: draft.name } : {}) };
    const ok = await saveQueuedClip(entry);
    setSavedNotice(ok ? null : 'This phone has no space to save the video.');
    if (ok) setStep('queued');
    return ok;
  }

  async function startUpload(target_: Clip, forProduct = product) {
    setError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) { await queueForLater(target_); return; }
    const frame = await ensureFrame(target_);
    setProgress({ sent: 0, total: target_.blob.size });
    setStage('uploading');
    setStep('uploading');
    try {
      const common = { video: target_.blob, mimeType: target_.mimeType, durationSec: target_.durationSec, thumb: frame, onProgress: setProgress, onStage: setStage };
      const handle = isIntro || !forProduct
        ? uploadIntroVideo({ merchantId: shop.id, ...common })
        : uploadProductClip({ merchantId: shop.id, productId: forProduct.id, ...common });
      upload.current = handle;
      await handle.done;
      upload.current = null;
      if (isIntro) await clearSavedVideo();
      else if (forProduct) await removeQueuedClip(productQueueKey(forProduct.id));
      setSaved(null);
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      await qc.invalidateQueries({ queryKey: ['my-product-clips'] });
      setStep('done');
    } catch (e) {
      if (upload.current === null) return; // cancelled
      upload.current = null;
      setError(e instanceof Error ? e.message : 'The upload did not finish. Please retry.');
      setStep('failed');
    }
  }

  async function cancelUpload() {
    const handle = upload.current;
    upload.current = null;
    await handle?.cancel();
    await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
    setStep('review');
  }

  async function saveForLater() {
    if (!clip) return;
    if (isIntro) {
      const ok = await saveVideoLocally({ ...clip, savedAt: new Date().toISOString() });
      setSavedNotice(ok ? 'Saved on this phone. It uploads by itself when you are back online.' : 'This phone has no space to save the video.');
      return;
    }
    await queueForLater(clip, error ?? undefined);
  }

  /** Video first: create the product from spoken or typed details, then upload its clip. */
  async function createProduct(details: DraftProduct) {
    if (!clip) return;
    setDraft(details);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const ok = await saveQueuedClip({
        blob: clip.blob, mimeType: clip.mimeType, durationSec: clip.durationSec, thumb: clip.thumb, savedAt: new Date().toISOString(),
        key: newProductQueueKey(), kind: 'new-product', draft: details, productName: details.name,
      });
      if (ok) setStep('queued'); else setError('This phone has no space to save the video.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const row = await saveMerchantProduct({ data: { ...details, active: true, image_url: null } });
      const created = { id: row.id, name: row.name, price_kes: row.price_kes, unit: row.unit };
      setProduct(created);
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      await startUpload(clip, created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The product could not be saved. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  const backToVideos = () => void navigate({ to: '/merchant/dashboard', search: { tab: 'Videos' } });

  // ---- Render -----------------------------------------------------------------
  const pct = progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;
  const ringDone = canStopRecording(elapsed, limits);
  const ring = Math.min(1, elapsed / limits.maxSec);
  const reminder = product ?? (target.kind === 'product' ? target.product : null);
  const title = isIntro ? 'Shop intro video' : 'Product reel video';

  return (
    <div className="landing reel-scope fixed inset-0 overflow-hidden">
      <div className="relative mx-auto flex h-full max-w-md flex-col">
        {/* Camera preview stays mounted while the camera is in use */}
        {(step === 'starting' || step === 'camera' || step === 'recording' || step === 'interrupted') && (
          <video ref={preview} muted playsInline autoPlay className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        )}

        <div className="reel-scrim-top relative z-20 flex items-center justify-between px-3 pb-6 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <button type="button" onClick={cancel} aria-label="Cancel" className="reel-glass grid h-10 w-10 place-items-center rounded-full"><X className="h-5 w-5" /></button>
          <p className="text-sm font-bold">{step === 'recording' || step === 'interrupted' ? `${formatClock(elapsed)} / ${formatClock(limits.maxSec)}` : title}</p>
          {(step === 'camera') ? (
            <button type="button" onClick={flip} aria-label={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'} className="reel-glass grid h-10 w-10 place-items-center rounded-full"><RefreshCcw className="h-5 w-5" /></button>
          ) : <span className="w-10" />}
        </div>

        <input ref={galleryInput} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={onPick} />
        <input ref={captureInput} type="file" accept="video/*" capture="environment" className="hidden" onChange={onPick} />

        <div className="relative z-10 flex flex-1 flex-col">
          {step === 'home' && (
            <Panel>
              <Video className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-2xl font-extrabold">
                {isIntro ? 'Introduce your shop in 30 seconds' : target.kind === 'product' ? `Video for ${target.product.name}` : 'New product reel'}
              </h1>
              <p className="mt-1 text-sm opacity-80">
                {isIntro
                  ? 'Customers see it on your shop page, in the reel and on your card on Home.'
                  : target.kind === 'product'
                    ? 'Products with a video come first in the reel.'
                    : 'Record first. Then say or type the name and price. One video makes the product and its reel.'}
              </p>
              {error && <Problem text={error} />}
              {saved && (
                <div className="mt-4 rounded-2xl bg-ink-foreground/10 p-3 text-left text-sm">
                  <p className="font-bold">A video is saved on this phone</p>
                  <p className="opacity-80">{Math.round(saved.durationSec)} s · {formatBytes(saved.blob.size)}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { const c = { blob: saved.blob, mimeType: saved.mimeType, durationSec: saved.durationSec, thumb: saved.thumb }; setClip(c); void startUpload(c); }} className="flex-1 rounded-full bg-primary px-3 py-2 font-extrabold text-primary-foreground">Upload now</button>
                    <button type="button" onClick={() => { void removeQueuedClip(isIntro ? 'intro' : productQueueKey(product?.id ?? '')); setSaved(null); }} aria-label="Delete saved video" className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink-foreground/30"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              <div className="mt-5 grid gap-2">
                {recordSupported ? (
                  <button type="button" onClick={() => setStep('tips')} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"><Camera className="h-5 w-5" />Record video</button>
                ) : (
                  <button type="button" onClick={() => captureInput.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"><Camera className="h-5 w-5" />Record with camera app</button>
                )}
                <button type="button" onClick={() => galleryInput.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30"><UploadIcon className="h-5 w-5" />Upload from gallery</button>
              </div>
              <p className="mt-3 text-xs opacity-70">{limits.minSec}–{limits.maxSec} seconds · hold the phone upright · MP4 or WebM</p>
            </Panel>
          )}

          {step === 'tips' && (
            <Panel>
              <Lightbulb className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">Quick tips</h1>
              <p className="mt-2 text-base">
                {isIntro ? 'Show your shop, say your name and what you sell. 15–30 seconds.' : 'Hold up the item, say the name and price. 10–15 seconds.'}
              </p>
              <ul className="mt-3 space-y-1 text-left text-sm opacity-80">
                <li>• Hold the phone upright.</li>
                <li>• Stand where it's bright and quiet.</li>
                <li>• We start with the back camera so you can show {isIntro ? 'your stall' : 'the item'}.</li>
              </ul>
              <button type="button" onClick={() => void openCamera('environment')} className="mt-5 w-full rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Got it</button>
            </Panel>
          )}

          {step === 'starting' && <div className="m-auto flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin" />Opening camera…</div>}

          {(step === 'camera' || step === 'recording') && (
            <>
              {/* Upright frame guide so clips come out portrait. */}
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-16 h-[62%] aspect-[9/16] -translate-x-1/2 rounded-3xl border-2 border-dashed border-ink-foreground/40" />
              {reminder && (
                <div className="reel-glass relative mx-auto mt-2 rounded-2xl px-4 py-2 text-center">
                  <p className="text-lg font-extrabold leading-tight">{reminder.name}</p>
                  <p className="text-base font-bold text-primary">{kes(reminder.price_kes)}{reminder.unit ? ` / ${reminder.unit}` : ''}</p>
                </div>
              )}
            </>
          )}

          {(step === 'camera' || step === 'recording') && (
            <div className="mt-auto flex flex-col items-center gap-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
              {step === 'recording' && !ringDone && <p className="reel-glass rounded-full px-3 py-1 text-xs font-bold">Keep going — you can stop at {formatClock(limits.minSec)}</p>}
              {step === 'recording' && ringDone && <p className="rounded-full bg-icon-green px-3 py-1 text-xs font-extrabold text-ink">Great! Stop any time</p>}
              <div className="relative grid h-24 w-24 place-items-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="7" className="stroke-ink-foreground/30" />
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - ring)} className={ringDone ? 'stroke-icon-green' : 'stroke-primary'} />
                </svg>
                {step === 'camera' ? (
                  <button type="button" onClick={startRecording} aria-label="Start recording" className="h-16 w-16 rounded-full bg-destructive ring-4 ring-ink-foreground/80" />
                ) : (
                  <button type="button" onClick={stopRecording} disabled={!ringDone} aria-label={ringDone ? 'Stop recording' : `Stop (available at ${limits.minSec} seconds)`} className="grid h-16 w-16 place-items-center rounded-full bg-ink-foreground/90 disabled:opacity-50">
                    <span className="h-6 w-6 rounded-md bg-destructive" />
                  </button>
                )}
              </div>
              <p className="text-sm font-bold">{step === 'camera' ? 'Tap to record' : ringDone ? 'Stop' : formatClock(limits.minSec - elapsed) + ' until you can stop'}</p>
            </div>
          )}

          {step === 'interrupted' && (
            <Panel>
              <AlertTriangle className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">Recording paused</h1>
              <p className="mt-1 text-sm opacity-80">You left the app at {formatClock(elapsed)}. Your recording so far is kept.</p>
              <div className="mt-5 grid gap-2">
                {cameraAlive() ? (
                  <button type="button" onClick={resumeRecording} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Resume</button>
                ) : (
                  canStopRecording(elapsed, limits) && <button type="button" onClick={stopRecording} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Use what I recorded</button>
                )}
                <button type="button" onClick={retake} className="rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30">Retake</button>
              </div>
            </Panel>
          )}

          {step === 'denied' && (
            <Panel>
              <Smartphone className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">
                {deniedReason === 'nocamera' ? 'No camera found' : deniedReason === 'unsupported' ? 'Recording here is not supported' : 'Camera access is off'}
              </h1>
              {deniedReason === 'denied' ? (
                <ol className="mt-2 space-y-1 text-left text-sm opacity-90">
                  <li>1. Tap the lock or ⓘ icon next to the web address.</li>
                  <li>2. Open <b>Permissions</b> and allow <b>Camera</b> and <b>Microphone</b>.</li>
                  <li>3. Come back and tap <b>Try again</b>.</li>
                </ol>
              ) : (
                <p className="mt-2 text-sm opacity-80">You can record with your phone's camera app or pick a video from your gallery instead.</p>
              )}
              <div className="mt-5 grid gap-2">
                {deniedReason === 'denied' && <button type="button" onClick={() => void openCamera()} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Try again</button>}
                <button type="button" onClick={() => captureInput.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30"><Camera className="h-5 w-5" />Record with camera app</button>
                <button type="button" onClick={() => galleryInput.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30"><UploadIcon className="h-5 w-5" />Upload from gallery</button>
              </div>
            </Panel>
          )}

          {step === 'preparing' && (
            <Panel>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">Preparing your video…</h1>
              <p className="mt-1 text-sm opacity-80">Making it smaller so it loads fast for customers.</p>
              <Bar value={prepareProgress} />
              <button type="button" onClick={() => prepareAbort.current?.abort()} className="mt-4 w-full rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30">Cancel</button>
            </Panel>
          )}

          {step === 'review' && clip && (
            <ReviewStep clip={clip} error={error} onRetake={retake} onUse={() => chooseClip(clip)} onSave={() => void saveForLater()} savedNotice={savedNotice} />
          )}

          {step === 'details' && clip && (
            <Panel>
              <h1 className="text-2xl font-extrabold">What are you selling?</h1>
              <p className="mt-1 text-sm opacity-80">Say it like: "Tomatoes, 50 shillings, 20 kilos".</p>
              {error && <Problem text={error} />}
              <button type="button" onClick={() => setVoiceOpen(true)} disabled={creating} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-4 text-lg font-extrabold text-primary-foreground disabled:opacity-50">
                <Mic className="h-6 w-6" />Speak product details
              </button>
              <form
                className="mt-4 grid gap-2 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createProduct({ name: typed.name.trim(), category: typed.category.trim() || 'Other', price_kes: Number(typed.price), stock: Number(typed.stock) });
                }}
              >
                <p className="flex items-center gap-2 text-sm font-bold opacity-80"><Keyboard className="h-4 w-4" />Or type</p>
                <input required maxLength={120} value={typed.name} onChange={e => setTyped({ ...typed, name: e.target.value })} placeholder="Name, e.g. Tomatoes" aria-label="Product name" className="rounded-2xl bg-ink-foreground/10 px-4 py-3 text-base outline-none ring-1 ring-ink-foreground/30" />
                <div className="grid grid-cols-2 gap-2">
                  <input required inputMode="numeric" pattern="[0-9]*" value={typed.price} onChange={e => setTyped({ ...typed, price: e.target.value.replace(/\D/g, '') })} placeholder="Price (KSh)" aria-label="Price in shillings" className="rounded-2xl bg-ink-foreground/10 px-4 py-3 text-base outline-none ring-1 ring-ink-foreground/30" />
                  <input required inputMode="numeric" pattern="[0-9]*" value={typed.stock} onChange={e => setTyped({ ...typed, stock: e.target.value.replace(/\D/g, '') })} placeholder="How many" aria-label="Quantity in stock" className="rounded-2xl bg-ink-foreground/10 px-4 py-3 text-base outline-none ring-1 ring-ink-foreground/30" />
                </div>
                <input maxLength={100} value={typed.category} onChange={e => setTyped({ ...typed, category: e.target.value })} placeholder="Category, e.g. Vegetables" aria-label="Category" className="rounded-2xl bg-ink-foreground/10 px-4 py-3 text-base outline-none ring-1 ring-ink-foreground/30" />
                <button type="submit" disabled={creating} className="mt-1 rounded-full px-5 py-3 text-base font-extrabold ring-1 ring-ink-foreground/40 disabled:opacity-50">
                  {creating ? 'Saving…' : 'Save product and video'}
                </button>
              </form>
            </Panel>
          )}

          {step === 'uploading' && (
            <Panel>
              <UploadIcon className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">{stage === 'processing' ? 'Preparing your video…' : 'Uploading your video'}</h1>
              <Bar value={pct / 100} />
              <p className="mt-2 text-sm font-bold" aria-live="polite">{pct}% · {formatBytes(progress.sent) || '0 KB'} of {formatBytes(progress.total)}</p>
              <p className="mt-1 text-xs opacity-70">If your connection drops, the upload continues where it stopped.</p>
              <button type="button" onClick={() => void cancelUpload()} className="mt-4 w-full rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30">Cancel</button>
            </Panel>
          )}

          {step === 'failed' && clip && (
            <Panel>
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="mt-3 text-xl font-extrabold">Upload failed</h1>
              {error && <p className="mt-1 text-sm opacity-90">{error}</p>}
              <div className="mt-5 grid gap-2">
                <button type="button" onClick={() => void startUpload(clip)} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"><RotateCcw className="h-5 w-5" />Retry</button>
                <button type="button" onClick={() => void saveForLater()} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30"><Save className="h-5 w-5" />Upload later</button>
              </div>
              {savedNotice && <p role="status" className="mt-3 text-sm">{savedNotice}</p>}
            </Panel>
          )}

          {step === 'queued' && (
            <Panel>
              <CloudOff className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-3 text-2xl font-extrabold">Saved: uploading later</h1>
              <p className="mt-1 text-sm opacity-80">Your video is kept on this phone. It uploads by itself when you are back online. Keep Beez open on Wi-Fi to finish.</p>
              <div className="mt-5 grid gap-2">
                <button type="button" onClick={backToVideos} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Back to Videos</button>
              </div>
            </Panel>
          )}

          {step === 'done' && (
            <Panel>
              <CheckCircle2 className="mx-auto h-12 w-12 text-icon-green" />
              <h1 className="mt-3 text-2xl font-extrabold">Sent for review</h1>
              <p className="mt-1 text-sm opacity-80">
                {UNDER_REVIEW_NOTE}. Customers see it once Beez approves it.
                {!isIntro && ' Until then your product photo shows in the reel.'}
              </p>
              <div className="mt-5 grid gap-2">
                <button type="button" onClick={backToVideos} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Back to Videos</button>
                {!isIntro && (
                  <button type="button" onClick={() => { setClip(null); setError(null); setProduct(target.kind === 'product' ? target.product : null); setDraft(null); setTyped({ name: '', price: '', stock: '', category: shop.category ?? '' }); setStep('tips'); }} className="rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/30">
                    Record another
                  </button>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {voiceOpen && (
        <VoiceProductCreator
          onClose={() => setVoiceOpen(false)}
          onPublish={async (d) => {
            if (!d.name?.trim() || d.price_kes === null || d.stock === null) throw new Error('Say the product name, price and how many you have.');
            setVoiceOpen(false);
            await createProduct({ name: d.name.trim(), category: d.category?.trim() || typed.category.trim() || 'Other', price_kes: d.price_kes, stock: d.stock });
          }}
        />
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop and discard this recording?</AlertDialogTitle>
            <AlertDialogDescription>What you've recorded so far will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep recording</AlertDialogCancel>
            <AlertDialogAction onClick={() => { discardRecording(); stopCamera(); backToVideos(); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewStep({ clip, error, onRetake, onUse, onSave, savedNotice }: { clip: Clip; error: string | null; onRetake: () => void; onUse: () => void; onSave: () => void; savedNotice: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip.blob]);
  return (
    <div className="absolute inset-0 flex flex-col">
      {url && <video src={url} controls autoPlay playsInline className="absolute inset-0 h-full w-full bg-ink object-contain" />}
      <div className="reel-scrim-bottom relative mt-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-20">
        <p className="text-sm font-bold">{Math.round(clip.durationSec)} seconds · {formatBytes(clip.blob.size)}</p>
        {error && <Problem text={error} />}
        {savedNotice && <p role="status" className="mt-2 text-sm">{savedNotice}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onRetake} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-bold ring-1 ring-ink-foreground/40"><RotateCcw className="h-5 w-5" />Retake</button>
          <button type="button" onClick={onUse} disabled={!!error} className="rounded-full bg-primary px-4 py-3 font-extrabold text-primary-foreground disabled:opacity-50">Use this video</button>
        </div>
        {!error && <button type="button" onClick={onSave} className="mt-2 w-full text-center text-xs font-bold underline opacity-80">Weak connection? Save on this phone and upload later</button>}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="m-auto w-full max-w-sm px-6 text-center">{children}</div>;
}
function Problem({ text }: { text: string }) {
  return <p role="alert" className="mt-3 rounded-2xl bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">{text}</p>;
}
function Bar({ value }: { value: number }) {
  return (
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink-foreground/20" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
