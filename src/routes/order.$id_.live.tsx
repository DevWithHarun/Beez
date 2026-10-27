import { createFileRoute } from '@tanstack/react-router';
import { Empty, MarketHeader, Shell } from '@/components/marketplace/shared';
import { LiveMap } from '@/components/marketplace/LiveMap';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order/$id_/live')({
  head: () => ({ meta: [{ title: 'Live Tracking | Beez' }, { name: 'description', content: 'See your rider live.' }, { property: 'og:title', content: 'Live Tracking | Beez' }, { property: 'og:description', content: 'Live rider map.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Live,
});
function Live() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const order = orders.find((o) => o.id === id);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Live Tracking" back="/track" /><p className="py-12 text-center text-muted-foreground">Connecting to live tracking…</p></Shell>;
  if (!order) return <Shell active="Track"><MarketHeader title="Live Tracking" back="/track" /><Empty title="Order not found" /></Shell>;
  return (
    <Shell active="Track" wide>
      <MarketHeader title="Live Tracking" back="/track" />
      <LiveMap orders={[order]} tall />
      <div className="market-rider">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2>{order.merchant_name}</h2>
            <small>{order.pickup_area} → {order.customer_area}</small>
            <small className="block">Order {order.id} · KES {order.total_kes}</small>
          </div>
          <span className="market-status">{order.status}</span>
        </div>
        <p className="arrival">{order.rider_lat != null ? 'Rider is on the map — position updates live' : 'Waiting for a rider to be assigned'}</p>
      </div>
    </Shell>
  );
}
