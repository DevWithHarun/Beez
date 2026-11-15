// Merchant "Videos" section: setup checklist, shop intro, new product reel,
// "Uploading later" queue and the reel manager. Dark dashboard styling.
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, Circle, Clapperboard, Image as ImageIcon, Play, RefreshCcw, Trash2, EyeOff, Eye, ArrowUp, ArrowDown,
  CloudOff, UploadCloud, Loader2, AlertTriangle, Clock3, X,
} from 'lucide-react';
import { MyStoreVideoCard } from '@/components/merchant-video/MyStoreVideoCard';
import { merchantQuery } from '@/lib/merchant-query';
import { saveMerchantProduct } from '@/lib/merchant.functions';
import { uploadIntroVideo } from '@/lib/merchant-video-api';
import { loadMyProductClips, removeProductClip, saveReelOrder, setReelHidden, uploadProductClip, type ProductClip } from '@/lib/reel-video-api';
import {
  UNDER_REVIEW_NOTE, introReviewState, moveInOrder, productReelStatus, rejectFix, setupChecklist, sortForReelManager,
  type ProductReelStatus,
} from '@/lib/reel-video';
import { listQueuedClips, removeQueuedClip, saveQueuedClip, type QueuedClip } from '@/lib/video-local';
import { thumbnailFromVideo } from '@/lib/video-capture';
import { formatBytes } from '@/lib/reel-feed';

type Merchant = Parameters<typeof MyStoreVideoCard>[0]['merchant'] & {
  video_reject_reason?: string | null;
};
type Product = {
  id: string; name: string; price_kes: number; stock: number; active: boolean; image_url: string | null;
  created_at: string; reel_hidden?: boolean | null; reel_position?: number | null;
};

const hiddenText: Record<NonNullable<ProductReelStatus['hidden']>, string> = {
  hidden: 'Hidden from reel',
  out_of_stock: 'Hidden: out of stock',
  inactive: 'Product switched off',
  no_media: 'Skipped: add a photo or video',
};

export const productClipsQuery = (merchantId: string) => ({
  queryKey: ['my-product-clips', merchantId],
  queryFn: () => loadMyProductClips(merchantId),
  staleTime: 0,
});

export function MerchantVideosTab({ merchant, products, onNotice }: { merchant: Merchant; products: Product[]; onNotice: (text: string) => void }) {
  const qc = useQueryClient();
  const clipsQuery = useQuery(productClipsQuery(merchant.id));
  const clips = clipsQuery.data?.clips ?? new Map<string, ProductClip>();
  const available = clipsQuery.data?.available ?? true;
  const [busy, setBusy] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [previewing, setPreviewing] = useState<ProductClip | null>(null);

  const statuses = new Map(products.map(p => [p.id, productReelStatus(p, clips.get(p.id))]));
  const checklist = setupChecklist({ intro: introReviewState(merchant), isOpen: merchant.is_open !== false, products: [...statuses.values()] });
  const ordered = sortForReelManager(products, clips);

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: merchantQuery.queryKey }),
      qc.invalidateQueries({ queryKey: ['my-product-clips', merchant.id] }),
    ]);
  }, [qc, merchant.id]);

  const act = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key);
    try { await fn(); await refresh(); onNotice(done); }
    catch (e) { onNotice(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(null); }
  };

  const move = (id: string, direction: -1 | 1) => {
    const ids = moveInOrder(ordered.map(p => p.id), id, direction);
    void act(`move:${id}`, () => saveReelOrder(ids), 'Reel order saved');
  };

  return (
    <div className="grid gap-5">
      {/* Setup checklist */}
      <section className="card p-5">
        <h3 className="font-semibold">Get your shop into the reel</h3>
        <ul className="mt-3 grid gap-2">
          {checklist.map(item => (
            <li key={item.key} className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3">
              {item.done ? <CheckCircle2 className="shrink-0 text-emerald-400" size={22} aria-label="Done" /> : <Circle className="shrink-0 text-slate-400" size={22} aria-label="Not done yet" />}
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{item.label}</b>
                <small className="text-slate-300">{item.detail}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">A product counts with a photo or a video. Products with a video show first in the reel.</p>
      </section>

      {/* Main action: one recording makes the product and its reel item */}
      <section className="card p-5">
        <Link to="/m/video" search={{ new: '1', start: 'record' }} className="add-product w-full py-4 text-base">
          <Clapperboard size={22} /> New product reel
        </Link>
        <p className="mt-2 text-center text-sm text-slate-300">Record the item, then say or type the name and price.</p>
      </section>

      <UploadLaterList merchantId={merchant.id} products={products} onDone={refresh} onNotice={onNotice} />

      <MyStoreVideoCard merchant={merchant} onNotice={onNotice} />

      {/* Reel manager */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Your reel</h3>
          {available && ordered.length > 1 && (
            <button type="button" className="view-btn" onClick={() => setReordering(r => !r)}>{reordering ? 'Done' : 'Reorder'}</button>
          )}
        </div>
        {!available && (
          <p className="mt-2 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">
            Product videos switch on once the latest Beez update is applied. You can still record now; videos wait on this phone.
          </p>
        )}
        {clipsQuery.isError && <p className="mt-2 text-sm text-amber-300">Your reel videos could not be loaded. <button type="button" className="underline" onClick={() => void clipsQuery.refetch()}>Try again</button></p>}
        {!products.length && <p className="mt-3 text-sm text-slate-300">No products yet. Tap <b>New product reel</b> to add your first one.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {ordered.map((p, index) => {
            const clip = clips.get(p.id) ?? null;
            const st = statuses.get(p.id)!;
            const thumb = clip?.thumb_url ?? p.image_url;
            return (
              <li key={p.id} className={`flex gap-3 rounded-xl bg-black/20 p-3 ${st.hidden ? 'opacity-80' : ''}`}>
                <button
                  type="button"
                  onClick={() => clip && setPreviewing(clip)}
                  disabled={!clip}
                  aria-label={clip ? `Preview video for ${p.name}` : p.name}
                  className="relative h-28 w-16 shrink-0 overflow-hidden rounded-lg bg-black"
                >
                  {thumb ? <img src={thumb} alt="" className={`h-full w-full object-cover ${st.hidden ? 'grayscale' : ''}`} /> : <span className="grid h-full place-items-center text-xs text-slate-400">No photo</span>}
                  {clip && <span className="absolute inset-0 grid place-items-center"><Play size={18} className="fill-white text-white" /></span>}
                  <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1 text-sm" aria-label={st.media === 'video' ? 'Video' : st.media === 'photo' ? 'Photo' : 'Nothing to show'}>
                    {st.media === 'video' ? '🎬' : st.media === 'photo' ? '📷' : '—'}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{p.name}</b>
                  <ClipBadge clip={clip} />
                  {st.hidden && <small className="mt-1 block text-amber-300">{hiddenText[st.hidden]}</small>}
                  {st.nudge && <small className="mt-1 block text-slate-300">Photo only · Add video to rank higher</small>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Link to="/m/video" search={{ product: p.id, start: 'record' }} className={clip ? 'view-btn' : 'add-product px-3 py-1.5 text-xs'}>
                      {clip ? <><RefreshCcw size={13} />Replace</> : <><Clapperboard size={14} />Add video</>}
                    </Link>
                    {clip && (
                      <button type="button" className="view-btn" disabled={busy !== null} onClick={() => void act(`del:${p.id}`, () => removeProductClip(p.id), 'Video deleted')}>
                        <Trash2 size={13} />Delete
                      </button>
                    )}
                    {available && (
                      <button type="button" className="view-btn" disabled={busy !== null} onClick={() => void act(`hide:${p.id}`, () => setReelHidden(p.id, !p.reel_hidden), p.reel_hidden ? 'Back in the reel' : 'Hidden from the reel')}>
                        {p.reel_hidden ? <><Eye size={13} />Show in reel</> : <><EyeOff size={13} />Hide from reel</>}
                      </button>
                    )}
                    {reordering && (
                      <>
                        <button type="button" className="view-btn" aria-label={`Move ${p.name} up`} disabled={busy !== null || index === 0} onClick={() => move(p.id, -1)}><ArrowUp size={14} /></button>
                        <button type="button" className="view-btn" aria-label={`Move ${p.name} down`} disabled={busy !== null || index === ordered.length - 1} onClick={() => move(p.id, 1)}><ArrowDown size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {previewing && (
        <div className="modal-backdrop" onClick={() => setPreviewing(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-x" aria-label="Close preview" onClick={() => setPreviewing(null)}><X /></button>
            <video src={previewing.video_url} poster={previewing.thumb_url} controls autoPlay playsInline className="max-h-[80vh] rounded-xl bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

function ClipBadge({ clip }: { clip: ProductClip | null }) {
  if (!clip) return <small className="mt-1 inline-flex items-center gap-1 text-slate-400"><ImageIcon size={12} />No video yet</small>;
  if (clip.status === 'live') return <small className="mt-1 inline-flex items-center gap-1 font-semibold text-emerald-300">✅ Live</small>;
  if (clip.status === 'rejected') {
    return <small className="mt-1 block text-amber-300"><AlertTriangle size={12} className="mr-1 inline" />⚠ {rejectFix(clip.reject_reason)}</small>;
  }
  return <small className="mt-1 inline-flex items-center gap-1 text-sky-300"><Clock3 size={12} />⏳ {UNDER_REVIEW_NOTE}</small>;
}

/** Videos recorded without signal. They upload by themselves when the phone is back online. */
function UploadLaterList({ merchantId, products, onDone, onNotice }: {
  merchantId: string; products: Product[]; onDone: () => Promise<void>; onNotice: (t: string) => void;
}) {
  const [queue, setQueue] = useState<QueuedClip[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const running = useRef(false);

  const reload = useCallback(async () => setQueue(await listQueuedClips()), []);

  const uploadOne = useCallback(async (clip: QueuedClip) => {
    setWorking(clip.key);
    setProgress(0);
    try {
      const thumb = clip.thumb ?? (await thumbnailFromVideo(clip.blob));
      if (!thumb) throw new Error('This video could not be read. Please record it again.');
      const common = {
        video: clip.blob, mimeType: clip.mimeType, durationSec: clip.durationSec, thumb,
        onProgress: (p: { sent: number; total: number }) => setProgress(p.total ? p.sent / p.total : 0), onStage: () => undefined,
      };
      if (clip.kind === 'intro') {
        await uploadIntroVideo({ merchantId, ...common }).done;
      } else {
        let productId = clip.productId;
        if (!productId) {
          if (!clip.draft) throw new Error('Add the product details first.');
          const row = await saveMerchantProduct({ data: { ...clip.draft, active: true, image_url: null } });
          productId = row.id;
          // Remember the new product so a failed upload never creates it twice.
          await saveQueuedClip({ ...clip, productId, kind: 'product', productName: row.name });
        }
        await uploadProductClip({ merchantId, productId, ...common }).done;
      }
      await removeQueuedClip(clip.key);
      onNotice('Video uploaded and sent for review');
      await onDone();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Upload did not finish. It will try again later.');
      return false;
    } finally {
      setWorking(null);
      await reload();
    }
    return true;
  }, [merchantId, onDone, onNotice, reload]);

  // Retry everything automatically whenever the connection comes back.
  const uploadAll = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    try {
      for (const clip of await listQueuedClips()) {
        if (!navigator.onLine) break;
        if (!(await uploadOne(clip))) break;
      }
    } finally { running.current = false; }
  }, [uploadOne]);

  useEffect(() => {
    void reload().then(() => void uploadAll());
    const onOnline = () => void uploadAll();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [reload, uploadAll]);

  if (!queue.length) return null;
  const nameOf = (c: QueuedClip) =>
    c.kind === 'intro' ? 'Shop intro' : c.productName ?? products.find(p => p.id === c.productId)?.name ?? 'New product';

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 font-semibold"><CloudOff size={18} />Uploading later</h3>
      <p className="mt-1 text-sm text-slate-300">These videos are saved on this phone. They upload by themselves when you are online.</p>
      <ul className="mt-3 grid gap-2">
        {queue.map(c => (
          <li key={c.key} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200">{working === c.key ? `${Math.round(progress * 100)}%` : 'Uploading later'}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{nameOf(c)}</b>
              <small className="text-slate-400">{Math.round(c.durationSec)} s · {formatBytes(c.blob.size)}</small>
            </span>
            <button type="button" className="view-btn" disabled={working !== null} onClick={() => void uploadOne(c)}>
              {working === c.key ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}Upload now
            </button>
            <button type="button" className="view-btn" aria-label={`Delete saved video for ${nameOf(c)}`} disabled={working !== null} onClick={() => void removeQueuedClip(c.key).then(reload)}>
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
