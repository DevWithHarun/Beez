import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleCheck, MapPin, Store } from 'lucide-react';
import { itemCount } from '@/components/marketplace/track-parts';
import { MpesaPaymentPanel } from '@/components/payments/MpesaPaymentPanel';
import { useLiveOrders } from '@/lib/live-orders';

export const Route = createFileRoute('/order-confirmed/$id')({
  head: () => ({ meta: [{ title: 'Order Placed | Beez' }, { name: 'description', content: 'Your Beez order has been placed. Pay with M-Pesa or cash and follow it live.' }, { property: 'og:title', content: 'Order Placed | Beez' }, { property: 'og:description', content: 'Thanks for supporting local vendors.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Confirmed,
});

const ksh = (n: number) => `KSh ${n.toLocaleString()}`;

function Confirmed() {
  const { id } = Route.useParams();
  const { orders, loaded } = useLiveOrders();
  const o = orders.find(order => order.id === id);
  const awaitingMpesa = o?.payment_method === 'M-Pesa' && o.payment_status === 'Unpaid' && o.status !== 'Cancelled';

  return (
    <div className="landing min-h-dvh">
      <main className="mx-auto max-w-xl space-y-3 px-3 pb-10 pt-8">
        <div className="text-center">
          <CircleCheck className="mx-auto h-14 w-14 text-icon-mpesa" strokeWidth={1.8} />
          <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{awaitingMpesa ? 'One last step' : 'Order placed!'}</h1>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
            {awaitingMpesa ? 'Pay with M-Pesa so the shop can start on your order.' : "The shop has your order. We'll keep you updated."}
          </p>
        </div>

        <MpesaPaymentPanel orderId={id} />

        {!loaded && <p className="text-center text-[13px] text-muted-foreground">Loading order details…</p>}
        {o && (
          <section aria-label="Order summary" className="rounded-3xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">Order #{o.id}</h2>
              <span className="text-[12px] text-muted-foreground">{itemCount(o)} {itemCount(o) === 1 ? "item" : "items"}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Store className="h-3.5 w-3.5" />{o.merchant_name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{o.customer_area}</p>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="font-semibold">{ksh(o.total_kes - o.delivery_fee_kes)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="font-semibold">{o.delivery_fee_kes ? ksh(o.delivery_fee_kes) : 'Free'}</dd></div>
              <div className="flex justify-between text-[15px]"><dt className="font-extrabold">Total</dt><dd className="font-extrabold">{ksh(o.total_kes)}</dd></div>
            </dl>
          </section>
        )}

        <div className="grid gap-2 pt-1">
          <Link to="/track/$orderId" params={{ orderId: id }} className="flex h-12 items-center justify-center rounded-full bg-primary text-[14px] font-extrabold text-primary-foreground shadow-card">Track order</Link>
          <Link to="/order/$id" params={{ id }} className="flex h-12 items-center justify-center rounded-full border border-border bg-card text-[14px] font-bold">View order details</Link>
          <Link to="/discover" className="flex h-12 items-center justify-center rounded-full text-[14px] font-bold text-muted-foreground">Continue shopping</Link>
        </div>
      </main>
    </div>
  );
}
