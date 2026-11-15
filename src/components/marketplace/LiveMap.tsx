import { lazy, Suspense } from 'react';
import type { DbOrder } from '@/lib/live-orders';

// Leaflet is browser-only: the CSS and the map module load lazily after hydration.
if (typeof window !== 'undefined') void import('@/leaflet-css');
const LiveMapClient = lazy(() => import('./live-map-view'));

export function LiveMap({ orders, tall = false }: { orders: DbOrder[]; tall?: boolean }) {
  return (
    <Suspense fallback={<div className="market-map" style={{ height: tall ? 440 : 300 }} />}>
      <LiveMapClient orders={orders} tall={tall} />
    </Suspense>
  );
}
