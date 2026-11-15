import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertCircle, Banknote, CircleCheck, Loader2, RotateCw, Smartphone } from 'lucide-react';
import { getMpesaPayment, payCashInstead, startMpesaPayment } from '@/lib/mpesa.functions';
import { kenyanMobile } from '@/lib/checkout';

const ksh = (n: number) => `KSh ${n.toLocaleString()}`;

/** Live M-Pesa payment state for one order: waiting for PIN, paid, or retry / pay cash. */
export function MpesaPaymentPanel({ orderId }: { orderId: string }) {
  const fetchPayment = useServerFn(getMpesaPayment);
  const sendPrompt = useServerFn(startMpesaPayment);
  const switchToCash = useServerFn(payCashInstead);

  const payment = useQuery({
    queryKey: ['mpesa-payment', orderId],
    queryFn: () => fetchPayment({ data: { orderId } }),
    refetchInterval: q => (q.state.data?.attempt?.status === 'requested' && q.state.data.orderPaymentStatus === 'Unpaid' ? 3000 : false),
    retry: 1,
  });
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'cash'>('');
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const p = payment.data;

  useEffect(() => { if (p && !phone) setPhone(p.defaultPhone); }, [p, phone]);
  // Re-render each few seconds so "Send again" appears on time.
  useEffect(() => {
    if (p?.attempt?.status !== 'requested') return;
    const t = window.setInterval(() => tick(n => n + 1), 5000);
    return () => window.clearInterval(t);
  }, [p?.attempt?.status]);

  if (payment.isPending) {
    return <Card><div className="flex items-center gap-3 text-[13.5px] text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking your payment…</div></Card>;
  }
  if (payment.isError || !p) {
    return <Card><p className="text-[13.5px]">We couldn't check your payment just now.</p>
      <button type="button" onClick={() => void payment.refetch()} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-bold"><RotateCw className="h-4 w-4" />Try again</button></Card>;
  }

  const send = async () => {
    const number = kenyanMobile(phone);
    if (!number) { setError('Use a Kenyan M-Pesa number, like 0712 345 678.'); return; }
    setBusy('send'); setError('');
    try {
      await sendPrompt({ data: { orderId, phone: number } });
      await payment.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "M-Pesa couldn't send the prompt. Please try again.");
    } finally { setBusy(''); }
  };
  const cash = async () => {
    setBusy('cash'); setError('');
    try {
      await switchToCash({ data: { orderId } });
      await payment.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch to cash. Please try again.");
    } finally { setBusy(''); }
  };

  if (p.orderPaymentStatus === 'Paid') {
    return <Card tone="success">
      <div className="flex items-start gap-3">
        <CircleCheck className="h-7 w-7 shrink-0 text-icon-mpesa" strokeWidth={2.2} />
        <div>
          <p className="text-[15px] font-extrabold">{p.orderPaymentMethod === 'M-Pesa' ? `Paid ${ksh(p.amountKes)} with M-Pesa` : 'Paid'}</p>
          {p.attempt?.receipt && <p className="mt-0.5 text-[12.5px] text-muted-foreground">M-Pesa receipt <span className="font-mono font-bold text-foreground">{p.attempt.receipt}</span></p>}
        </div>
      </div>
    </Card>;
  }
  if (p.orderPaymentStatus === 'Refund Pending' || p.orderPaymentStatus === 'Refunded') {
    return <Card><p className="text-[14px] font-extrabold">{p.orderPaymentStatus === 'Refunded' ? 'Your money was sent back' : "Your payment came in after the order closed"}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{p.orderPaymentStatus === 'Refunded' ? 'Check your M-Pesa messages for the refund.' : "We'll send it back to your M-Pesa."}</p></Card>;
  }
  if (p.orderPaymentMethod !== 'M-Pesa') {
    return <Card><div className="flex items-start gap-3"><Banknote className="h-6 w-6 shrink-0" />
      <div><p className="text-[14px] font-extrabold">Pay {ksh(p.amountKes)} in cash</p><p className="mt-0.5 text-[12.5px] text-muted-foreground">Pay the rider when your order arrives, or the shop when you collect.</p></div></div></Card>;
  }
  if (p.orderStatus === 'Cancelled') {
    return <Card><p className="text-[14px] font-extrabold">This order was cancelled</p><p className="mt-1 text-[12.5px] text-muted-foreground">Nothing to pay.</p></Card>;
  }

  const waiting = p.attempt?.status === 'requested';
  const cashButton = (
    <button type="button" onClick={() => void cash()} disabled={!!busy || waiting}
      className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-bold disabled:opacity-50">
      {busy === 'cash' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}Pay cash instead
    </button>
  );

  if (waiting && p.attempt) {
    return <Card>
      <div className="flex items-start gap-3">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-icon-mpesa/15 text-icon-mpesa">
          <Smartphone className="h-6 w-6" strokeWidth={2.2} />
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-icon-mpesa" />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold leading-tight">Check your phone</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Enter your M-Pesa PIN on <span className="font-bold text-foreground">{p.attempt.phone}</span> to pay <span className="font-bold text-foreground">{ksh(p.amountKes)}</span>.</p>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Waiting for M-Pesa…</p>
        </div>
      </div>
      {error && <ErrorLine text={error} />}
      {p.attempt.canResend && (
        <button type="button" onClick={() => void send()} disabled={!!busy}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-bold disabled:opacity-50">
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}Didn't get it? Send again
        </button>
      )}
    </Card>;
  }

  return <Card>
    <p className="text-[16px] font-extrabold leading-tight">Pay {ksh(p.amountKes)} with M-Pesa</p>
    {p.attempt && p.attempt.status !== 'paid' && <ErrorLine text={`${p.attempt.message} You can try again.`} />}
    {!p.available ? (
      <>
        <p className="mt-1 text-[13px] text-muted-foreground">M-Pesa payments aren't switched on yet. Pay cash when your order arrives.</p>
        {error && <ErrorLine text={error} />}
        <div className="mt-3 flex">{cashButton}</div>
      </>
    ) : (
      <>
        <p className="mt-1 text-[13px] text-muted-foreground">We'll send a prompt to this phone. Enter your M-Pesa PIN to pay.</p>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12.5px] font-bold">M-Pesa number</span>
          <span className="flex h-12 items-center overflow-hidden rounded-2xl border border-border bg-secondary/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
            <span className="grid h-full place-items-center border-r border-border px-3 text-[13px] font-bold text-muted-foreground">+254</span>
            <input className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} aria-label="M-Pesa number" />
          </span>
        </label>
        {error && <ErrorLine text={error} />}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void send()} disabled={!!busy}
            className="inline-flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-extrabold text-primary-foreground disabled:opacity-60">
            {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}{p.attempt ? 'Send prompt again' : 'Send M-Pesa prompt'}
          </button>
          {cashButton}
        </div>
      </>
    )}
  </Card>;
}

function Card({ children, tone }: { children: React.ReactNode; tone?: 'success' }) {
  return <section aria-label="Payment" aria-live="polite"
    className={'rounded-3xl border p-4 shadow-card ' + (tone === 'success' ? 'border-icon-mpesa/40 bg-icon-mpesa/10' : 'border-border bg-card')}>{children}</section>;
}

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-2xl bg-destructive/10 px-3 py-2 text-[12.5px] font-semibold text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{text}</p>;
}
