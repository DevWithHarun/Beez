import { Link } from '@tanstack/react-router';
import { Loader2, Store } from 'lucide-react';

/** Full-screen loading / not-found / error states for shop pages. */
export function ShopState({ kind, onRetry, dark = false }: { kind: 'loading' | 'missing' | 'error'; onRetry?: () => void; dark?: boolean }) {
  return (
    <div className={`landing ${dark ? 'reel-scope' : ''} grid min-h-[100dvh] place-items-center px-6 text-center`}>
      {kind === 'loading' ? (
        <div role="status" className="flex items-center gap-2 text-sm opacity-80"><Loader2 className="h-5 w-5 animate-spin" />Opening the shop…</div>
      ) : (
        <div className="max-w-sm">
          <Store className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-xl font-extrabold">{kind === 'missing' ? 'Shop not found' : "This shop didn't load"}</h1>
          <p className="mt-1 text-sm opacity-80">{kind === 'missing' ? 'The link may be old, or the shop is no longer on Beez.' : 'Please check your connection and try again.'}</p>
          <div className="mt-5 grid gap-2">
            {kind === 'error' && onRetry && <button type="button" onClick={onRetry} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground">Try again</button>}
            <Link to="/discover" className={`rounded-full px-5 py-3 font-bold ${kind === 'missing' ? 'bg-primary text-primary-foreground' : 'ring-1 ring-border'}`}>Back to Home</Link>
          </div>
        </div>
      )}
    </div>
  );
}
