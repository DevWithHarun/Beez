import { useCallback, useEffect, useRef, useState } from 'react';
import { PageTitle } from '@/components/admin/AdminShell';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv, useTable } from '@/lib/admin-data';
import { REJECT_REASONS, REJECT_REASON_KEYS, type RejectReason } from '@/lib/reel-video';
import { approveShopVideos, loadReviewLog, loadReviewQueue, reviewVideo, type ReviewItem, type ReviewLogRow } from '@/lib/reel-video-api';

type Stat = { merchant_id: string; merchant_name: string; product_id: string | null; product_name: string | null; views: number; adds: number; shares: number; shop_visits: number; intro_views: number };

const itemKey = (item: ReviewItem) => `${item.kind}:${item.target}`;

function submittedAgo(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function reasonLabel(reason: string | null): string {
  const key = REJECT_REASON_KEYS.find(k => k === reason);
  return key ? REJECT_REASONS[key].label : '—';
}

const decisionLabels: Record<ReviewLogRow['decision'], string> = { submitted: 'Submitted', live: 'Approved', rejected: 'Rejected' };

/** Pilot: approve every merchant video before customers see it, and see how the reel performs. */
export function ReelAdminPage() {
  const { rows, error: merchantsError } = useTable<{ id: string; name: string }>('merchants');
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [history, setHistory] = useState<ReviewLogRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState<RejectReason | ''>('');

  useEffect(() => {
    setStats(null);
    void supabase.rpc('admin_reel_stats', { _days: days }).then(({ data, error: e }) => {
      if (e) setStatsError('Reel stats are not available yet.');
      else { setStatsError(null); setStats((data ?? []) as Stat[]); }
    });
  }, [days]);

  const reloadReviews = useCallback(async () => {
    setQueueLoading(true); setHistoryLoading(true); setQueueError(null); setHistoryError(null);
    await Promise.all([
      loadReviewQueue()
        .then(result => { setItems(result.items); setAvailable(result.available); })
        .catch((e: unknown) => setQueueError(e instanceof Error ? e.message : 'The review queue could not be loaded.'))
        .finally(() => setQueueLoading(false)),
      loadReviewLog(50)
        .then(setHistory)
        .catch((e: unknown) => setHistoryError(e instanceof Error ? e.message : 'The review history could not be loaded.'))
        .finally(() => setHistoryLoading(false)),
    ]);
  }, []);

  useEffect(() => { void reloadReviews(); }, [reloadReviews]);

  const runAction = async (action: () => Promise<string>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setMsg(null);
    try {
      setMsg(await action());
      setRejecting(null); setReason('');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      await reloadReviews();
      actionLock.current = false;
      setBusy(false);
    }
  };

  const review = (item: ReviewItem, decision: 'live' | 'rejected', picked?: RejectReason) => {
    if (decision === 'rejected' && !picked) return;
    void runAction(async () => {
      const { texted } = await reviewVideo(item, decision, picked);
      const sms = texted ? ' The merchant was sent a text.' : '';
      return decision === 'live' ? `Approved — now live for customers.${sms}` : `Rejected: ${REJECT_REASONS[picked!].label}. The merchant sees how to fix it.${sms}`;
    });
  };

  const shopNames = new Map(rows.map(row => [row.id, row.name]));
  const shops = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    shopNames.set(item.merchantId, item.shopName);
    shops.set(item.merchantId, { name: item.shopName, count: (shops.get(item.merchantId)?.count ?? 0) + 1 });
  }
  const actionsDisabled = busy || queueLoading || queueError !== null;

  const shopTotals = Object.values((stats ?? []).reduce<Record<string, Stat>>((acc, s) => {
    const t = acc[s.merchant_id] ?? { ...s, product_id: null, product_name: null, views: 0, adds: 0, shares: 0, shop_visits: 0, intro_views: 0 };
    t.views += Number(s.views); t.adds += Number(s.adds); t.shares += Number(s.shares); t.shop_visits += Number(s.shop_visits); t.intro_views += Number(s.intro_views);
    acc[s.merchant_id] = t; return acc;
  }, {})).sort((a, b) => b.adds - a.adds || b.views - a.views);

  return (
    <div className="ad-page">
      <PageTitle title="Reel & videos" sub={`${items.length} video${items.length === 1 ? '' : 's'} waiting for review`} />
      {msg && <p className="ad-msg" role="status">{msg}</p>}

      <div className="ad-card">
        <h3>Waiting for review</h3>
        <p className="ad-muted">Oldest first. Customers only see a video after you approve it.</p>
        {queueLoading && <p className="ad-muted">Loading…</p>}
        {queueError && (
          <div>
            <p className="ad-msg" role="alert">{queueError}</p>
            <button className="ad-btn ghost" disabled={busy || queueLoading} onClick={() => void reloadReviews()}>Retry</button>
          </div>
        )}
        {available === false && (
          <p className="ad-muted">Product video review switches on once the latest saved-data update is applied. Shop intros can still be reviewed.</p>
        )}
        {!queueLoading && !queueError && items.length === 0 && <p className="ad-muted">No videos waiting for review.</p>}

        <div className="flex flex-wrap gap-2">
          {Array.from(shops.entries()).filter(([, shop]) => shop.count >= 2).map(([merchantId, shop]) => (
            <button
              key={merchantId}
              className="ad-btn"
              disabled={actionsDisabled}
              onClick={() => void runAction(async () => {
                const count = await approveShopVideos(merchantId);
                return `${count} video${count === 1 ? '' : 's'} approved from ${shop.name}.`;
              })}
            >
              Approve all from {shop.name}
            </button>
          ))}
        </div>

        {items.map(item => {
          const key = itemKey(item);
          const what = item.kind === 'intro' ? 'Shop intro' : item.productName ?? 'Product video';
          return (
            <div key={key} className="ad-card mt-3 flex flex-wrap gap-4">
              <video
                src={item.videoUrl}
                poster={item.thumbUrl ?? undefined}
                controls
                preload="none"
                playsInline
                aria-label={`${item.shopName}: ${what}`}
                style={{ width: 120, height: 213, objectFit: 'cover', borderRadius: 8, background: '#000' }}
              />
              <div>
                <h4>{item.shopName}</h4>
                <p>{what}</p>
                <p className="ad-muted">
                  {item.durationSec === null ? '—' : `${Math.round(item.durationSec)} s`} · {item.sizeBytes === null ? '—' : `${(item.sizeBytes / 1048576).toFixed(1)} MB`}
                </p>
                <p className="ad-muted">Submitted {submittedAgo(item.submittedAt)}</p>
                <div className="mt-2 flex gap-2">
                  <button className="ad-btn" disabled={actionsDisabled} onClick={() => review(item, 'live')}>Approve</button>
                  <button className="ad-btn ghost" disabled={actionsDisabled} onClick={() => { setRejecting(key); setReason(''); }}>Reject</button>
                </div>
                {rejecting === key && (
                  <fieldset disabled={actionsDisabled} className="mt-3">
                    <legend className="ad-muted">Why? The merchant sees how to fix it.</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {REJECT_REASON_KEYS.map(k => (
                        <button key={k} type="button" className={reason === k ? 'ad-btn' : 'ad-btn ghost'} aria-pressed={reason === k} onClick={() => setReason(k)}>
                          {REJECT_REASONS[k].label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="ad-btn" disabled={actionsDisabled || !reason} onClick={() => { if (reason) review(item, 'rejected', reason); }}>Confirm reject</button>
                      <button type="button" className="ad-btn ghost" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</button>
                    </div>
                  </fieldset>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="ad-card">
        <h3>Review history</h3>
        {merchantsError && <p className="ad-msg">{merchantsError}</p>}
        {historyLoading && <p className="ad-muted">Loading…</p>}
        {historyError && <p className="ad-msg" role="alert">{historyError}</p>}
        {!historyLoading && !historyError && history.length === 0 && <p className="ad-muted">No reviews yet.</p>}
        {history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="ad-table">
              <thead><tr><th>When</th><th>Shop</th><th>What</th><th>Decision</th><th>Reason</th></tr></thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{shopNames.get(row.merchant_id) ?? 'Shop'}</td>
                    <td>{row.kind === 'intro' ? 'Shop intro' : 'Product video'}</td>
                    <td><span className="ad-pill">{decisionLabels[row.decision]}</span></td>
                    <td>{reasonLabel(row.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ad-card">
        <div className="flex items-center justify-between gap-2">
          <h3>Reel performance</h3>
          <div className="flex gap-2">
            <select className="ad-input" value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}</select>
            {stats && stats.length > 0 && <button className="ad-btn ghost" onClick={() => exportCsv('reel-stats.csv', stats)}>Export CSV</button>}
          </div>
        </div>
        {statsError && <p className="ad-msg">{statsError}</p>}
        {!stats && !statsError && <p className="ad-muted">Loading…</p>}
        {stats && stats.length === 0 && <p className="ad-muted">No reel activity yet.</p>}
        {shopTotals.length > 0 && (
          <>
            <h4 className="mt-3">By shop</h4>
            <table className="ad-table"><thead><tr><th>Shop</th><th>Views</th><th>Adds</th><th>Shares</th><th>Shop visits</th><th>Intro views</th></tr></thead>
              <tbody>{shopTotals.map(s => <tr key={s.merchant_id}><td>{s.merchant_name}</td><td>{s.views}</td><td>{s.adds}</td><td>{s.shares}</td><td>{s.shop_visits}</td><td>{s.intro_views}</td></tr>)}</tbody></table>
            <h4 className="mt-3">By product</h4>
            <table className="ad-table"><thead><tr><th>Product</th><th>Shop</th><th>Views</th><th>Adds</th><th>Add rate</th><th>Shares</th></tr></thead>
              <tbody>{stats!.filter(s => s.product_id).map(s => <tr key={`${s.merchant_id}-${s.product_id}`}><td>{s.product_name}</td><td>{s.merchant_name}</td><td>{s.views}</td><td>{s.adds}</td><td>{Number(s.views) ? `${Math.round((Number(s.adds) / Number(s.views)) * 100)}%` : '—'}</td><td>{s.shares}</td></tr>)}</tbody></table>
          </>
        )}
      </div>
    </div>
  );
}
