import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { QrCode, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { createCustomerOrder } from '@/lib/shop.functions';

export const Route = createFileRoute('/scan-pay')({
  head: () => ({ meta: [{ title: 'Scan & Pay | Beez' }, { name: 'description', content: 'Pay with an M-Pesa QR code.' }, { property: 'og:title', content: 'Scan & Pay | Beez' }, { property: 'og:description', content: 'Scan to pay with M-Pesa.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ScanPay,
});
function ScanPay() {
  const [tab, setTab] = useState<'qr' | 'otp'>('qr'); const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  const { cart, delivery, address, clear } = useMarketplace(); const nav = useNavigate();
  const done = async () => {
    if (tab === 'otp' && code.length < 6) return;
    if (Object.keys(cart).length === 0) {
      await nav({ to: '/cart' });
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const order = await createCustomerOrder({ data: {
        items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
        delivery,
        address,
        paymentMethod: 'M-Pesa',
      } });
      clear();
      await nav({ to: '/order-confirmed/$id', params: { id: order.id } });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Your order could not be placed. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return <Shell><MarketHeader title="Scan & Pay" back="/payment" />
    <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1"><Button variant={tab === 'qr' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setTab('qr')}>QR Code</Button><Button variant={tab === 'otp' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setTab('otp')}>Delivery / OTP</Button></div>
    {tab === 'qr' ? <><div className="market-qr text-market-canvas"><QrCode className="h-full w-full" /></div><p className="text-center text-xs text-muted-foreground">Scan this QR code with your M-Pesa app to complete the payment.</p><p className="my-5 text-center text-xs">OR</p><Button variant="outline" className="market-cta" disabled={saving} onClick={() => void done()}><Smartphone />{saving ? 'Placing order…' : 'Pay with M-Pesa Number'}</Button></>
      : <label className="market-field">Enter 6-digit code<input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><Button className="market-cta" disabled={code.length < 6 || saving} onClick={() => void done()}>{saving ? 'Placing order…' : 'Confirm'}</Button></label>}
    {err && <p role="alert" className="market-error">{err}</p>}
    <SafeNote>Payment is secured by M-Pesa.</SafeNote>
  </Shell>;
}
