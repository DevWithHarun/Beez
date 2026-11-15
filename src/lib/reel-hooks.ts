// Browser-only hooks shared by the reel, shop page and intro player.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import type { LatLng } from '@/lib/reel-feed';

type NetworkInfo = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };

function readLowData(): boolean {
  try {
    const stored = localStorage.getItem('beez-low-data');
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch { /* ignore */ }
  const c = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
}

/** Low-data mode: the phone's Data Saver, a 2G connection, or the shopper's choice. */
export function useLowDataMode() {
  const [low, setLow] = useState(false);
  useEffect(() => {
    setLow(readLowData());
    const c = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    const update = () => setLow(readLowData());
    c?.addEventListener?.('change', update);
    return () => c?.removeEventListener?.('change', update);
  }, []);
  const set = useCallback((value: boolean) => {
    try { localStorage.setItem('beez-low-data', value ? 'on' : 'off'); } catch { /* ignore */ }
    setLow(value);
  }, []);
  return [low, set] as const;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const LOCATION_KEY = 'beez-reel-location';
type LocationChoice = { kind: 'unknown' } | { kind: 'skipped' } | { kind: 'shared'; at: LatLng };

/** The shopper's location for "nearby", asked once and remembered on this phone. */
export function useCustomerLocation() {
  const [choice, setChoice] = useState<LocationChoice | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null');
      if (saved?.kind === 'skipped') return setChoice({ kind: 'skipped' });
      if (saved?.kind === 'shared' && Number.isFinite(saved.at?.lat) && Number.isFinite(saved.at?.lng)) return setChoice(saved);
    } catch { /* ignore */ }
    setChoice({ kind: 'unknown' });
  }, []);
  const save = (next: LocationChoice) => {
    setChoice(next);
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const request = () => {
    setError(null);
    if (!('geolocation' in navigator)) { setError('This phone cannot share its location. Showing newest products instead.'); save({ kind: 'skipped' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocating(false); save({ kind: 'shared', at: { lat: pos.coords.latitude, lng: pos.coords.longitude } }); },
      () => { setLocating(false); setError('Location was not shared. Showing newest products instead.'); save({ kind: 'skipped' }); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  };
  const skip = () => save({ kind: 'skipped' });
  const reset = () => { try { localStorage.removeItem(LOCATION_KEY); } catch { /* ignore */ } setChoice({ kind: 'unknown' }); };
  return {
    ready: choice !== null,
    needsAsk: choice?.kind === 'unknown',
    location: choice?.kind === 'shared' ? choice.at : null,
    locating, error, request, skip, reset,
  };
}

/** Close button: go back when there is history, otherwise go Home (shared-link case). */
export function useCloseOrHome() {
  const router = useRouter();
  const navigate = useNavigate();
  return useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/discover' });
  }, [router, navigate]);
}

export function useOrigin() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}
