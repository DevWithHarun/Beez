import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';
import { HandoverCodeDialog } from '@/components/handover/HandoverCodeDialog';
import { canShowHandover } from '@/lib/handover';
import { useLiveOrder } from '@/lib/live-orders';

// The customer's delivery code: show the QR (or read the 4-digit code) to the rider.
export const Route = createFileRoute('/order/$id_/scan')({
  head: () => ({ meta: [{ title: 'Delivery Code | Beez' }, { name: 'description', content: 'Show your delivery QR code to your Beez rider.' }, { property: 'og:title', content: 'Delivery Code | Beez' }, { property: 'og:description', content: 'Confirm your delivery with a QR code.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: DeliveryCode,
});

function DeliveryCode() {
  const { id } = Route.useParams();
  const { order, loaded } = useLiveOrder(id);
  const [open, setOpen] = useState(false);
  if (!loaded) return <Shell active="Track"><MarketHeader title="Delivery code" back="/track" /><p className="py-12 text-center text-muted-foreground">Loading order…</p></Shell>;
  if (!order) return <Shell active="Track"><MarketHeader title="Delivery code" back="/track" /><Empty title="Order not found" /></Shell>;
  const ready = !!order.rider_id && canShowHandover('dropoff', order.status);
  return <Shell active="Track"><MarketHeader title="Delivery code" back="/track" />
    <div className="market-summary">
      <h2 className="font-bold">Order #{order.id}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {order.status === 'Delivered' ? 'This order has been delivered.' : ready ? 'When the rider arrives, show them your QR code. It confirms you received your order.' : 'Your code appears once the rider has picked up your order.'}
      </p>
    </div>
    {order.status === 'Delivered'
      ? <Button asChild className="market-cta"><Link to="/order/$id/delivered" params={{ id: order.id }}>View receipt</Link></Button>
      : <Button className="market-cta" disabled={!ready} onClick={() => setOpen(true)}><QrCode /> Show delivery QR</Button>}
    <HandoverCodeDialog orderId={order.id} kind="dropoff" status={order.status} open={open} onOpenChange={setOpen} />
    <SafeNote>Only your assigned rider can use this code, and only once.</SafeNote>
  </Shell>;
}
