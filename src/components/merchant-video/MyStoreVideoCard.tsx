import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Video, Upload, Play, RefreshCcw, Trash2, Loader2, AlertTriangle, X, Copy, Store } from 'lucide-react';
import { effectiveVideoStatus } from '@/lib/merchant-video';
import { UNDER_REVIEW_NOTE, introReviewState, rejectFix } from '@/lib/reel-video';
import { removeIntroVideo, setShopOpen } from '@/lib/merchant-video-api';
import { merchantQuery } from '@/lib/merchant-query';

type MerchantRow = {
  id: string; name: string; slug?: string | null; is_open?: boolean;
  video_url?: string | null; video_thumb_url?: string | null; video_status?: string | null;
  video_review_status?: string | null; video_updated_at?: string | null; video_duration?: number | string | null;
  video_reject_reason?: string | null;
};

/** My Store: shop open switch, public link and the intro-video card. */
export function MyStoreVideoCard({ merchant, onNotice }: { merchant: MerchantRow; onNotice: (text: string) => void }) {
  const qc = useQueryClient();
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<'delete' | 'open' | null>(null);
  const status = effectiveVideoStatus(merchant.video_status, merchant.video_updated_at);
  const review = introReviewState(merchant);
  const isOpen = merchant.is_open !== false;
  const path = merchant.slug || merchant.id;

  const refresh = () => qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
  const toggleOpen = async () => {
    setBusy('open');
    try { await setShopOpen(merchant.id, !isOpen); await refresh(); onNotice(isOpen ? 'Shop closed — your products are hidden from the reel' : 'Shop open — customers can order'); }
    catch (e) { onNotice(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy('delete');
    try { await removeIntroVideo(); await refresh(); onNotice('Video deleted'); setConfirmDelete(false); }
    catch (e) { onNotice(e instanceof Error ? e.message : 'Could not delete'); }
    finally { setBusy(null); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/shop/${path}`); onNotice('Shop link copied'); }
    catch { onNotice('Could not copy the link'); }
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold"><Store size={18} />My Store · Shop intro</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <span>{isOpen ? 'Open' : 'Closed'}</span>
          <button type="button" role="switch" aria-checked={isOpen} aria-label="Shop open for orders" disabled={busy === 'open'} onClick={() => void toggleOpen()}
            className={`relative h-6 w-11 rounded-full transition ${isOpen ? 'bg-emerald-500' : 'bg-slate-500'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${isOpen ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
        <Link to="/shop/$slug" params={{ slug: path }} className="truncate underline">/shop/{path}</Link>
        <button type="button" onClick={() => void copyLink()} aria-label="Copy shop link" className="rounded p-1 hover:bg-white/10"><Copy size={14} /></button>
      </div>

      <div className="mt-4 rounded-xl bg-black/20 p-4">
        {status === 'none' && (
          <>
            <p className="flex items-center gap-2 font-semibold"><Video size={18} />Introduce your shop in 30 seconds</p>
            <p className="mt-1 text-sm text-slate-300">Show your shop, say your name and what you sell. It plays on your shop page and in the reel.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/m/video" search={{ start: 'record' }} className="add-product"><Video size={16} />Record video</Link>
              <Link to="/m/video" search={{ start: 'upload' }} className="view-btn"><Upload size={15} />Upload from gallery</Link>
            </div>
          </>
        )}
        {(status === 'uploading' || status === 'processing') && (
          <p className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Uploading your video…</p>
        )}
        {status === 'failed' && (
          <div>
            <p className="flex items-center gap-2 font-semibold text-amber-300"><AlertTriangle size={18} />Upload failed</p>
            <Link to="/m/video" className="add-product mt-3 inline-flex"><RefreshCcw size={15} />Retry</Link>
          </div>
        )}
        {status === 'ready' && (
          <div className="flex gap-4">
            <button type="button" onClick={() => setPreviewing(true)} className="relative h-32 w-20 shrink-0 overflow-hidden rounded-lg bg-black" aria-label="Preview video">
              {merchant.video_thumb_url && <img src={merchant.video_thumb_url} alt="" className="h-full w-full object-cover" />}
              <span className="absolute inset-0 grid place-items-center"><Play size={22} className="fill-white text-white" /></span>
            </button>
            <div className="min-w-0">
              <p className="font-semibold">
                {review === 'live' ? '✅ Your intro video is live' : review === 'rejected' ? '⚠ Not approved' : '⏳ Under review'}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {review === 'rejected'
                  ? rejectFix(merchant.video_reject_reason)
                  : review === 'live' ? 'Customers see it on your shop page and in the reel.' : `${UNDER_REVIEW_NOTE}. Customers see it once Beez approves it.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreviewing(true)} className="view-btn"><Play size={14} />Preview</button>
                <Link to="/m/video" search={{ start: 'record' }} className="view-btn"><RefreshCcw size={14} />Replace</Link>
                <button type="button" onClick={() => setConfirmDelete(true)} className="view-btn"><Trash2 size={14} />Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {previewing && merchant.video_url && (
        <div className="modal-backdrop" onClick={() => setPreviewing(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-x" aria-label="Close preview" onClick={() => setPreviewing(false)}><X /></button>
            <video src={merchant.video_url} poster={merchant.video_thumb_url ?? undefined} controls autoPlay playsInline className="max-h-[80vh] rounded-xl bg-black" />
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
            <h2>Delete your shop video?</h2>
            <p className="text-sm text-slate-300">Customers will no longer see it. You can record a new one any time.</p>
            <button type="button" className="primary-button" disabled={busy === 'delete'} onClick={() => void remove()}>{busy === 'delete' ? 'Deleting…' : 'Delete video'}</button>
            <button type="button" className="view-btn mt-2" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </div>
        </div>
      )}
    </section>
  );
}
