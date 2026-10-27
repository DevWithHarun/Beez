import { createFileRoute, Link } from '@tanstack/react-router';
import { MapPin, ArrowRight } from 'lucide-react';
import { Empty, MarketHeader, Shell } from '@/components/marketplace/shared';
import { Timeline } from '@/components/marketplace/track-parts';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order/$id_/progress')({
  head: () => ({ meta: [{ title: 'Order Progress | Beez' }, { name: 'description', content: 'Each step of your order.' }, { property: 'og:title', content: 'Order Progress | Beez' }, { property: 'og:description', content: 'Order timeline.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProgressPage,
});
function ProgressPage() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Order Progress" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!o) return <Shell active="Track"><MarketHeader title="Order Progress" back="/track" /><Empty title="Order not found" /></Shell>;
  return <Shell active="Track"><MarketHeader title="Order Progress" back="/track" /><Timeline order={o} />
    {o.status !== 'Delivered' && <Link to="/order/$id/live" params={{ id }} className="market-summary flex items-center gap-3"><MapPin className="h-6 w-6 text-primary" /><div className="flex-1"><h2>Your order is on the way!</h2><p className="text-xs text-muted-foreground">We're almost there. Your rider is nearby.</p></div><ArrowRight className="text-primary" /></Link>}
  </Shell>;
}
