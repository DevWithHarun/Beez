import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/track-number')({
  head: () => ({ meta: [{ title: 'Track by Order Number | Beez' }, { name: 'description', content: 'Enter your order number for live updates.' }, { property: 'og:title', content: 'Track by Order Number | Beez' }, { property: 'og:description', content: 'Find your order.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: TrackNumber,
});
function TrackNumber() {
  const [v, setV] = useState(''); const [err, setErr] = useState(''); const { orders, loaded } = useLiveOrders(); const nav = useNavigate();
  const go = () => { const o = orders.find(x => x.id.toLowerCase() === v.trim().replace('#', '').toLowerCase()); if (!o) return setErr('We could not find that order number.'); nav({ to: '/order/$id/track', params: { id: o.id } }); };
  return <Shell active="Track"><MarketHeader title="Track by Order Number" back="/track" />
    <div className="market-success"><FileSearch className="!text-primary" /><h1 className="!text-lg">Enter your order number</h1><p>Get real-time updates on your delivery.</p></div>
    <label className="market-field"><input aria-label="Order number" placeholder="BEE27842" value={v} onChange={e => { setV(e.target.value); setErr(''); }} /></label>
    {err && <p className="market-error">{err}</p>}
    <Button className="market-cta" disabled={!v.trim() || !loaded} onClick={go}>Track Order</Button><SafeNote>You can also find your order in the Track tab.</SafeNote>
  </Shell>;
}
