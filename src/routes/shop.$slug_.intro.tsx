import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { X, Volume2, VolumeX, Share2, RotateCcw, Clapperboard, Store, ShoppingBag, Play } from 'lucide-react';
import { ShopState } from '@/components/reel/ShopState';
import { shopQuery } from '@/lib/shop-queries';
import { formatBytes, formatDistance, introShareText, shopDistanceKm, whatsappShareUrl } from '@/lib/reel-feed';
import { logReelEvent } from '@/lib/reel-api';
import { useCloseOrHome, useCustomerLocation, useLowDataMode, useOrigin } from '@/lib/reel-hooks';

export const Route = createFileRoute('/shop/$slug_/intro')({
  head: () => ({
    meta: [
      { title: 'Meet the shop – intro video | Beez' },
      { name: 'description', content: 'Watch a short video from a local Beez shop, then order or browse their products.' },
      { property: 'og:title', content: 'Meet the shop on Beez' },
      { property: 'og:description', content: 'A 30-second hello from a local shop on Beez.' },
      { property: 'og:type', content: 'video.other' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: IntroPage,
});

function IntroPage() {
  const { slug } = Route.useParams();
  const shop = useQuery(shopQuery(slug));
  const close = useCloseOrHome();
  const origin = useOrigin();
  const [lowData] = useLowDataMode();
  const where = useCustomerLocation();
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loadAllowed, setLoadAllowed] = useState(false);
  const logged = useRef(false);

  useEffect(() => { setLoadAllowed(!lowData); }, [lowData]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);

  if (shop.isPending) return <ShopState kind="loading" dark />;
  if (shop.isError) return <ShopState kind="error" dark onRetry={() => void shop.refetch()} />;
  if (!shop.data) return <ShopState kind="missing" dark />;
  const s = shop.data;
  const distance = formatDistance(shopDistanceKm(s, where.location));

  const replay = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    void v.play();
  };
  const togglePause = () => {
    const v = video.current;
    if (!v || ended) return;
    if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };
  const share = () => {
    logReelEvent('share', s.id, null);
    window.open(whatsappShareUrl(introShareText(s, origin)), '_blank', 'noopener');
  };

  return (
    <div className="landing reel-scope fixed inset-0 overflow-hidden">
      <div className="relative mx-auto h-full max-w-md">
        {s.video ? (
          loadAllowed ? (
            <video
              ref={video}
              src={s.video.url}
              poster={s.video.thumbUrl ?? undefined}
              autoPlay
              muted={muted}
              playsInline
              preload={lowData ? 'none' : 'auto'}
              onClick={togglePause}
              onPlay={() => { if (!logged.current) { logged.current = true; logReelEvent('intro_view', s.id, null); } }}
              onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && Number.isFinite(v.duration)) setProgress(v.currentTime / v.duration); }}
              onEnded={() => { setEnded(true); setProgress(1); }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0">
              {s.video.thumbUrl ? <img src={s.video.thumbUrl} alt={`${s.name} video preview`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="reel-shimmer absolute inset-0" />}
              <button type="button" onClick={() => setLoadAllowed(true)} className="reel-glass absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold">
                <Play className="h-5 w-5 fill-current" /> Tap to load{s.video.sizeBytes ? ` · ${formatBytes(s.video.sizeBytes)}` : ''}
              </button>
            </div>
          )
        ) : (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <Clapperboard className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-3 text-xl font-extrabold">{s.name} hasn't added a video yet</h1>
              <p className="mt-1 text-sm opacity-80">You can still see their products.</p>
            </div>
          </div>
        )}

        {/* Progress along the top + top bar */}
        <div className="reel-scrim-top absolute inset-x-0 top-0 z-20 px-3 pb-6 pt-[max(env(safe-area-inset-top),0.75rem)]">
          {s.video && (
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-ink-foreground/25" role="progressbar" aria-label="Video progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={close} aria-label="Close video" className="reel-glass grid h-10 w-10 place-items-center rounded-full"><X className="h-5 w-5" /></button>
            {s.video && loadAllowed && (
              <button type="button" onClick={() => setMuted(m => !m)} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} className="reel-glass grid h-10 w-10 place-items-center rounded-full">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {paused && !ended && <span className="reel-glass pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-bold">Paused</span>}

        {/* When the video ends it freezes on the last frame with next steps. */}
        {ended && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-ink/50 px-8">
            <div className="grid w-full max-w-xs gap-2">
              <button type="button" onClick={replay} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/40"><RotateCcw className="h-5 w-5" />Replay</button>
              <Link to="/shop/$slug/reel" params={{ slug: s.path }} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"><Clapperboard className="h-5 w-5" />Browse products</Link>
              <Link to="/shop/$slug" params={{ slug: s.path }} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold ring-1 ring-ink-foreground/40"><Store className="h-5 w-5" />Visit shop</Link>
            </div>
          </div>
        )}

        {/* Bottom overlay */}
        <div className="reel-scrim-bottom absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-24">
          <h1 className="text-2xl font-extrabold">{s.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {s.area && <span className="opacity-80">{s.area}</span>}
            {distance && <span className="opacity-80">· {distance}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${s.isOpen ? 'bg-icon-green text-ink' : 'bg-ink-foreground/20'}`}>{s.isOpen ? 'Open' : 'Closed'}</span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Link to="/shop/$slug" params={{ slug: s.path }} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-3 text-sm font-extrabold text-primary-foreground"><ShoppingBag className="h-4 w-4" />Order now</Link>
            <Link to="/shop/$slug/reel" params={{ slug: s.path }} className="reel-glass inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-3 text-sm font-bold ring-1 ring-ink-foreground/30"><Clapperboard className="h-4 w-4 shrink-0" />Browse products</Link>
            <button type="button" onClick={share} aria-label="Share on WhatsApp" className="reel-glass grid h-full w-12 place-items-center rounded-full ring-1 ring-ink-foreground/30"><Share2 className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
