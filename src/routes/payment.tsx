import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Smartphone, Wallet, Landmark, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, Shell } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { subtotal } from '@/lib/marketplace';
import { useCatalog } from '@/lib/shop-data';
import { createCustomerOrder } from '@/lib/shop.functions';
import { toE164 } from '@/lib/phone';

export const Route = createFileRoute('/payment')({
  head: () => ({ meta: [{ title: 'Payment | Beez' }, { name: 'description', content: 'Pay with M-Pesa, cash or bank.' }, { property: 'og:title', content: 'Payment | Beez' }, { property: 'og:description', content: 'Pay for your order.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Payment,
});
function Payment() {
  const { cart, delivery, address, clear } = useMarketplace(); const nav = useNavigate();
  const catalog = useCatalog();
  const [m, setM] = useState('mpesa'); const [phone, setPhone] = useState('712 345 678'); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const total = subtotal(cart, catalog.data ?? []) + (delivery ? 50 : 0);
  if (!Object.keys(cart).length) return <Shell><MarketHeader title="Payment" back="/checkout" /><Empty title="Your cart is empty"><Button asChild className="market-cta"><Link to="/groceries">Shop now</Link></Button></Empty></Shell>;
  const pay = async () => {
    if (m === 'mpesa' && phone.replace(/\D/g, '').length < 9) {
      setErr('Enter a valid M-Pesa number.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const order = await createCustomerOrder({ data: {
        items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
        delivery,
        address,
        paymentMethod: m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash on Delivery' : 'Bank Transfer',
        customerPhone: m === 'mpesa' ? toE164(phone) : '',
      } });
      clear();
      await nav({ to: '/order-confirmed/$id', params: { id: order.id } });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Your order could not be placed. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const opt = (id: string, Icon: typeof Wallet, t: string, d: string) => <label className="market-option"><input type="radio" name="pm" checked={m === id} onChange={() => setM(id)} /><Icon /><span>{t}<small>{d}</small></span></label>;
  return <Shell><MarketHeader title="Payment" back="/checkout" /><h2 className="font-bold">Select Payment Method</h2>
    {opt('mpesa', Smartphone, 'M-Pesa', 'Pay with your M-Pesa number')}{opt('cash', Wallet, 'Cash on Delivery', 'Pay when you receive your order')}{opt('bank', Landmark, 'Bank Transfer', 'Pay using your bank')}
    {m === 'mpesa' && <label className="market-field"><b className="text-sm">M-Pesa Details</b>Phone Number<span className="flex items-center rounded-md border border-border bg-card px-3"><span className="text-sm">+254</span><input className="!border-0" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); setErr(''); }} /></span></label>}
    {catalog.isError && <p role="alert" className="market-error">Products could not be loaded. Please try again.</p>}
    {err && <p role="alert" className="market-error">{err}</p>}
    <Button className="market-cta" disabled={saving || catalog.isPending || catalog.isError} onClick={() => void pay()}>{saving ? 'Placing order…' : `Pay KES ${total}`}</Button>
    {m === 'mpesa' && <><Button asChild variant="outline" className="market-cta !mt-3"><Link to="/scan-pay"><QrCode />Scan & Pay instead</Link></Button><p className="market-safe">You will receive an STK push on your phone. Enter your M-Pesa PIN to complete the payment.</p></>}
  </Shell>;
}
