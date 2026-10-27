import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';
import { advanceOrderStatus, useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order/$id_/scan')({
  head: () => ({ meta: [{ title: 'Scan Code | Beez' }, { name: 'description', content: 'Confirm your delivery.' }, { property: 'og:title', content: 'Scan Code | Beez' }, { property: 'og:description', content: 'Confirm delivery with a code.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Scan,
});
function Scan() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const confirm = async () => {
    setSaving(true);
    setErr('');
    try {
      await advanceOrderStatus(id);
      await nav({ to: '/order/$id/delivered', params: { id } });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Delivery could not be confirmed. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  if (!loaded) return <Shell active="Track"><MarketHeader title="Confirm Delivery" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!o) return <Shell active="Track"><MarketHeader title="Scan Code" back="/track" /><Empty title="Order not found" /></Shell>;
  return <Shell active="Track"><MarketHeader title="Confirm Delivery" back="/track" /><div className="market-summary">
    <h2 className="font-bold">Order #{o.id}</h2><p className="mt-2 text-sm text-muted-foreground">Delivery status is verified by Beez and the assigned rider.</p>
  </div>
    {err && <p className="market-error">{err}</p>}
    <Button className="market-cta" disabled={saving || o.status === 'Delivered'} onClick={() => void confirm()}>{saving ? 'Confirming…' : o.status === 'Delivered' ? 'Delivered' : 'Confirm Delivery'}</Button>
    <SafeNote>Only the assigned rider can update delivery status.</SafeNote>
  </Shell>;
}
