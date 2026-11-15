import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { QrCode, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';

export const Route = createFileRoute('/scan-pay')({
  head: () => ({ meta: [{ title: 'Scan & Pay | Beez' }, { name: 'description', content: 'Pay with an M-Pesa QR code.' }, { property: 'og:title', content: 'Scan & Pay | Beez' }, { property: 'og:description', content: 'Scan to pay with M-Pesa.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ScanPay,
});
function ScanPay() {
  const [tab, setTab] = useState<'qr' | 'otp'>('qr'); const [code, setCode] = useState('');
  const nav = useNavigate();
  // Orders are placed from checkout, which collects contact details and rechecks stock.
  const done = () => void nav({ to: '/checkout' });
  const saving = false; const err = '';
  return <Shell><MarketHeader title="Scan & Pay" back="/checkout" />
    <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1"><Button variant={tab === 'qr' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setTab('qr')}>QR Code</Button><Button variant={tab === 'otp' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setTab('otp')}>Delivery / OTP</Button></div>
    {tab === 'qr' ? <><div className="market-qr text-market-canvas"><QrCode className="h-full w-full" /></div><p className="text-center text-xs text-muted-foreground">Scan this QR code with your M-Pesa app to complete the payment.</p><p className="my-5 text-center text-xs">OR</p><Button variant="outline" className="market-cta" disabled={saving} onClick={done}><Smartphone />Pay with M-Pesa Number</Button></>
      : <label className="market-field">Enter 6-digit code<input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><Button className="market-cta" disabled={code.length < 6 || saving} onClick={done}>Confirm</Button></label>}
    {err && <p role="alert" className="market-error">{err}</p>}
    <SafeNote>Payment is secured by M-Pesa.</SafeNote>
  </Shell>;
}
