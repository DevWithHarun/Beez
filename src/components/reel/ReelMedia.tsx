import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { formatBytes } from '@/lib/reel-feed';

/** Full-bleed product photo with a shimmer placeholder and an optional slow zoom. */
export function ReelPhoto({ src, alt, zoom, dimmed }: { src: string; alt: string; zoom: boolean; dimmed?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {!loaded && <div className="reel-shimmer absolute inset-0" aria-hidden />}
      {!failed && (
        <>
          {/* Soft blurred fill behind portrait/landscape photos so no black bars show. */}
          {loaded && <img src={src} alt="" aria-hidden className="reel-blur-bg absolute inset-0 h-full w-full object-cover" />}
          <img
            src={src}
            alt={alt}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${zoom && loaded ? 'reel-zoom' : ''} ${dimmed ? 'grayscale' : ''}`}
          />
        </>
      )}
      {failed && <div className="absolute inset-0 grid place-items-center text-sm opacity-70">Photo unavailable</div>}
    </div>
  );
}

/**
 * A slide video. Autoplays muted while on screen; in low-data mode it shows
 * the poster with "Tap to load" and fetches nothing until tapped.
 */
export function ReelVideo({
  src, poster, active, muted, loop, lowData, sizeBytes, paused, onEnded, onProgress, videoRef,
}: {
  src: string; poster: string | null; active: boolean; muted: boolean; loop: boolean; lowData: boolean;
  sizeBytes: number | null; paused: boolean; onEnded?: () => void; onProgress?: (fraction: number) => void;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [allowed, setAllowed] = useState(!lowData);
  useEffect(() => { if (!lowData) setAllowed(true); }, [lowData]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !allowed) return;
    if (active && !paused) void v.play().catch(() => { /* autoplay blocked: poster stays */ });
    else v.pause();
  }, [active, paused, allowed]);
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  if (!allowed) {
    return (
      <div className="absolute inset-0">
        {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="reel-shimmer absolute inset-0" />}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAllowed(true); }}
          className="reel-glass absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
        >
          <Play className="h-5 w-5 fill-current" /> Tap to load{sizeBytes ? ` · ${formatBytes(sizeBytes)}` : ''}
        </button>
      </div>
    );
  }
  return (
    <video
      ref={(el) => { ref.current = el; if (videoRef) videoRef.current = el; }}
      src={src}
      poster={poster ?? undefined}
      muted={muted}
      loop={loop}
      playsInline
      preload={active ? 'auto' : 'metadata'}
      onEnded={onEnded}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (onProgress && v.duration && Number.isFinite(v.duration)) onProgress(v.currentTime / v.duration);
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
