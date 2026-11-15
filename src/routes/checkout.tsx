import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle, ArrowLeft, Banknote, Check, Loader2, Lock, MapPin, Minus, Plus, ShieldCheck,
  ShoppingBag, Smartphone, Store, Trash2, Truck, UserRound,
} from 'lucide-react';
import { Photo } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { supabase } from '@/integrations/supabase/client';
import { useCatalog } from '@/lib/shop-data';
import { createCustomerOrder } from '@/lib/shop.functions';
import { mpesaAvailable, startMpesaPayment } from '@/lib/mpesa.functions';
import { ensureShopperSession, isGuestUser } from '@/lib/guest-session';
import {
  DELIVERY_AREAS, INSTRUCTIONS_MAX, checkoutBlockers, checkoutTotals, deliveryAddress, kenyanMobile,
  type CheckoutLine, type CheckoutPayMethod,
} from '@/lib/checkout';

export const Route = createFileRoute('/checkout')({
  head: () => ({
    meta: [
      { title: 'Checkout | Beez' },
      { name: 'description', content: 'Review your basket, choose delivery or pickup, and place your Beez order.' },
      { property: 'og:title', content: 'Checkout | Beez' },
      { property: 'og:description', content: 'Place your order from a local Beez shop in under a minute.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Checkout,
});

const DETAILS_KEY = 'beez-checkout-details-v1';
type SavedDetails = { name: string; phone: string; area: string; details: string };

function useSessionUser() {
  const [state, setState] = useState<{ loaded: boolean; user: User | null }>({ loaded: false, user: null });
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => live && setState({ loaded: true, user: data.session?.user ?? null }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ loaded: true, user: session?.user ?? null }));
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

const ksh = (n: number) => `KSh ${n.toLocaleString()}`;

function Section({ n, title, icon: Icon, children, aside }: { n: number; title: string; icon: typeof Store; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-3xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[13px] font-extrabold text-primary-foreground">{n}</span>
        <h2 id={`step-${n}`} className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight"><Icon className="h-4 w-4" strokeWidth={2.4} />{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Choice({ checked, onSelect, icon: Icon, title, note, price, disabled = false }: { checked: boolean; onSelect: () => void; icon: typeof Store; title: string; note: string; price?: string; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onSelect} disabled={disabled}
      className={'relative flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ' + (checked ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary/60')}>
      <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl ' + (checked ? 'bg-primary text-primary-foreground' : 'bg-secondary')}><Icon className="h-5 w-5" strokeWidth={2.2} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{note}</span>
      </span>
      {price && <span className="text-[13px] font-extrabold">{price}</span>}
      {checked && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
    </button>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-bold">{label}{hint && <span className="font-normal text-muted-foreground">{hint}</span>}</span>
      {children}
      {error && <span className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-destructive"><AlertCircle className="h-3.5 w-3.5" />{error}</span>}
    </label>
  );
}

const inputClass = 'h-12 w-full rounded-2xl border border-border bg-secondary/50 px-4 text-[14px] outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20';

function Checkout() {
  const store = useMarketplace();
  const { cart, change, clear, delivery, setDelivery, instructions, setInstructions, ready, shops } = store;
  const catalog = useCatalog();
  const session = useSessionUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [details, setDetails] = useState('');
  const [method, setMethod] = useState<CheckoutPayMethod>('M-Pesa');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mpesa = useQuery({ queryKey: ['mpesa-available'], queryFn: () => mpesaAvailable(), staleTime: 5 * 60_000 });
  const mpesaOff = mpesa.data?.available === false;
  // When M-Pesa prompts aren't switched on, cash is the only way to pay.
  useEffect(() => { if (mpesaOff) setMethod('Cash on Delivery'); }, [mpesaOff]);

  // Fresh stock and prices every time checkout opens.
  useEffect(() => { void queryClient.invalidateQueries({ queryKey: ['catalog'] }); }, [queryClient]);

  // Remember contact and address details on this device.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DETAILS_KEY) ?? 'null') as Partial<SavedDetails> | null;
      if (saved) {
        setName(saved.name ?? ''); setPhone(saved.phone ?? ''); setDetails(saved.details ?? '');
        if (saved.area && (DELIVERY_AREAS as readonly string[]).includes(saved.area)) setArea(saved.area);
      }
    } catch { /* ignore unreadable saved details */ }
  }, []);
  useEffect(() => {
    const u = session.user;
    if (!u || isGuestUser(u)) return;
    const metaName = typeof u.user_metadata?.['full_name'] === 'string' ? (u.user_metadata['full_name'] as string) : '';
    setName(current => current || metaName);
    setPhone(current => current || (u.phone ? u.phone.replace(/^\+?254/, '0') : ''));
  }, [session.user]);

  const products = catalog.data ?? [];
  const cartIds = Object.keys(cart);
  const inCatalog = products.filter(p => (cart[p.id] ?? 0) > 0);
  const missingIds = catalog.isSuccess ? cartIds.filter(id => !products.some(p => p.id === id)) : [];
  const lines: CheckoutLine[] = inCatalog.map(p => ({ id: p.id, name: p.name, price: p.price, quantity: cart[p.id] ?? 0, stock: p.stock }));
  const merchantId = inCatalog.find(p => p.merchantId)?.merchantId ?? Object.values(shops)[0]?.merchantId ?? null;

  const shop = useQuery({
    queryKey: ['checkout-shop', merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error: shopError } = await supabase.from('merchants').select('id, name, area, is_open').eq('id', merchantId!).maybeSingle();
      if (shopError) throw new Error('Shop details could not be loaded.');
      return data;
    },
    staleTime: 30_000,
  });
  const shopName = shop.data?.name ?? inCatalog[0]?.merchantName ?? 'Local shop';

  const totals = checkoutTotals(lines, delivery);
  const blockers = useMemo(() => checkoutBlockers({
    lines, missing: missingIds.length, shopOpen: shop.data ? shop.data.is_open : null, delivery, area, name, phone,
  }), [lines, missingIds.length, shop.data, delivery, area, name, phone]);
  const showErrors = tried;
  const phoneError = showErrors && !kenyanMobile(phone) ? 'Use a number like 0712 345 678.' : undefined;
  const nameError = showErrors && name.trim().length < 2 ? 'Add your name.' : undefined;

  const goBack = () => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/cart' }));

  const place = async () => {
    setTried(true);
    setError('');
    if (blockers.length) {
      document.querySelector('[data-checkout-issues]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      // Guests order without an account; this gives the browser a private guest session for its orders.
      await ensureShopperSession();
      const order = await createCustomerOrder({ data: {
        items: lines.map(l => ({ productId: l.id, quantity: l.quantity })),
        delivery,
        address: delivery ? deliveryAddress(area, details) : `Pickup at ${shopName}`,
        paymentMethod: method,
        customerName: name.trim(),
        customerPhone: kenyanMobile(phone)!,
        instructions: delivery ? instructions.trim() : '',
      } });
      try {
        window.localStorage.setItem(DETAILS_KEY, JSON.stringify({ name: name.trim(), phone, area, details } satisfies SavedDetails));
      } catch { /* saving details is optional */ }
      clear();
      setInstructions('');
      // Send the "enter your PIN" prompt now; the next page shows its progress and any retry.
      if (method === 'M-Pesa') await startMpesaPayment({ data: { orderId: order.id } }).catch(() => undefined);
      await navigate({ to: '/order-confirmed/$id', params: { id: order.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your order could not be placed. Please try again.');
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } finally {
      setSaving(false);
    }
  };

  const loading = !ready || catalog.isPending || !session.loaded;
  const empty = ready && cartIds.length === 0;

  return (
    <div className="landing min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          <button type="button" onClick={goBack} aria-label="Go back" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"><ArrowLeft className="h-5 w-5" strokeWidth={2.4} /></button>
          <h1 className="text-[18px] font-extrabold tracking-tight">Checkout</h1>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold"><Lock className="h-3.5 w-3.5" />Secure</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-3 pb-44 pt-3">
        {loading && !empty && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading checkout">
            {[0, 1, 2].map(i => <div key={i} className="h-36 animate-pulse rounded-3xl bg-secondary" />)}
          </div>
        )}

        {empty && (
          <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-card">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/20"><ShoppingBag className="h-8 w-8" /></span>
            <h2 className="mt-4 text-[18px] font-extrabold">Nothing to check out yet</h2>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">Add something from a nearby shop and it will show up here.</p>
            <Link to="/discover" className="mt-5 rounded-full bg-primary px-6 py-3 text-[14px] font-extrabold text-primary-foreground">Start shopping</Link>
          </div>
        )}

        {!loading && !empty && catalog.isError && (
          <div role="alert" className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-[13px]">
            <p className="font-bold">Your basket could not be loaded.</p>
            <button type="button" onClick={() => void catalog.refetch()} className="mt-2 font-bold underline">Try again</button>
          </div>
        )}

        {!loading && !empty && !catalog.isError && (
          <>
            {/* 1. Basket */}
            <Section n={1} title="Your order" icon={ShoppingBag} aside={<Link to="/cart" className="text-[12px] font-bold underline-offset-2 hover:underline">Edit cart</Link>}>
              <div className="mb-3 flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2">
                <Store className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{shopName}{shop.data?.area ? <span className="font-normal text-muted-foreground"> · {shop.data.area}</span> : null}</span>
                {shop.data && (shop.data.is_open
                  ? <span className="rounded-full bg-icon-green/30 px-2 py-0.5 text-[10.5px] font-bold">Open</span>
                  : <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10.5px] font-bold text-destructive">Closed</span>)}
              </div>
              <ul className="divide-y divide-border">
                {inCatalog.map(p => {
                  const qty = cart[p.id] ?? 0;
                  const problem = p.stock <= 0 ? 'Sold out' : qty > p.stock ? `Only ${p.stock} left` : null;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <Photo product={p} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl !bg-secondary [&_img]:!h-full [&_img]:!w-full [&_img]:!object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-semibold leading-tight">{p.name}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{ksh(p.price)} each</p>
                        {problem && <p className="mt-0.5 text-[11.5px] font-bold text-destructive">{problem}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[13.5px] font-extrabold">{ksh(p.price * qty)}</span>
                        <div className="flex items-center rounded-full border border-border bg-card">
                          <button type="button" aria-label={qty <= 1 ? `Remove ${p.name}` : `One less ${p.name}`} onClick={() => change(p.id, -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary">
                            {qty <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          </button>
                          <span className="min-w-6 text-center text-[13px] font-bold" aria-label={`${qty} in basket`}>{qty}</span>
                          <button type="button" aria-label={`One more ${p.name}`} disabled={qty >= Math.min(p.stock, 99)} onClick={() => change(p.id, 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {missingIds.map(id => (
                  <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="text-[13px] text-muted-foreground">An item is no longer sold.</p>
                    <button type="button" onClick={() => change(id, -(cart[id] ?? 0))} className="text-[12px] font-bold text-destructive underline">Remove</button>
                  </li>
                ))}
              </ul>
            </Section>

            {/* 2. Delivery */}
            <Section n={2} title="How you get it" icon={Truck}>
              <div role="radiogroup" aria-label="Delivery or pickup" className="grid gap-2 min-[560px]:grid-cols-2">
                <Choice checked={delivery} onSelect={() => setDelivery(true)} icon={Truck} title="Delivery" note="A Beez rider brings it to your door" price={ksh(50)} />
                <Choice checked={!delivery} onSelect={() => setDelivery(false)} icon={Store} title="Pickup" note={`Collect it from ${shopName}`} price="Free" />
              </div>

              {delivery ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1.5 text-[12.5px] font-bold">Delivery area</p>
                    <div role="radiogroup" aria-label="Delivery area" className="flex flex-wrap gap-1.5">
                      {DELIVERY_AREAS.map(a => (
                        <button key={a} type="button" role="radio" aria-checked={area === a} onClick={() => setArea(a)}
                          className={'rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ' + (area === a ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-secondary')}>
                          {a}
                        </button>
                      ))}
                    </div>
                    {showErrors && !area && <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-destructive"><AlertCircle className="h-3.5 w-3.5" />Choose where we should deliver.</p>}
                  </div>
                  <Field label="House, street or landmark" hint="Optional">
                    <span className="relative block">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input className={inputClass + ' pl-10'} value={details} maxLength={160} autoComplete="street-address" placeholder="e.g. Blue gate opposite Naivas" onChange={e => setDetails(e.target.value)} />
                    </span>
                  </Field>
                  <Field label="Note for the rider" hint={`${instructions.length}/${INSTRUCTIONS_MAX}`}>
                    <textarea className={inputClass + ' h-auto min-h-[76px] resize-none py-3'} rows={2} maxLength={INSTRUCTIONS_MAX} value={instructions} placeholder="e.g. Call when you reach the gate" onChange={e => setInstructions(e.target.value)} />
                  </Field>
                </div>
              ) : (
                <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-secondary/60 p-3 text-[12.5px]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <p><b>{shopName}</b>{shop.data?.area ? `, ${shop.data.area}` : ''}. We'll let the shop know you're coming; show your order number when you collect.</p>
                </div>
              )}
            </Section>

            {/* 3. Contact */}
            <Section n={3} title="Your details" icon={UserRound}>
              <div className="space-y-3">
                <Field label="Full name" error={nameError}>
                  <input className={inputClass} value={name} maxLength={120} autoComplete="name" placeholder="e.g. Amina Hassan" onChange={e => setName(e.target.value)} />
                </Field>
                <Field label="Phone number" hint={delivery ? 'The rider calls this number' : 'The shop calls this number'} error={phoneError}>
                  <span className="flex h-12 items-center overflow-hidden rounded-2xl border border-border bg-secondary/50 focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/20">
                    <span className="flex h-full items-center border-r border-border px-3 text-[13px] font-bold">🇰🇪 +254</span>
                    <input className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none" inputMode="tel" autoComplete="tel-national" value={phone} placeholder="712 345 678" onChange={e => setPhone(e.target.value)} />
                    {kenyanMobile(phone) && <Check className="mr-3 h-4 w-4 text-icon-mpesa" strokeWidth={3} />}
                  </span>
                </Field>
              </div>
            </Section>

            {/* 4. Payment */}
            <Section n={4} title="Payment" icon={Banknote}>
              <div role="radiogroup" aria-label="Payment method" className="space-y-2">
                <Choice checked={method === 'M-Pesa'} onSelect={() => setMethod('M-Pesa')} disabled={mpesaOff} icon={Smartphone} title="M-Pesa"
                  note={mpesaOff ? 'Not available yet. Pay cash for now.' : "We'll send a prompt to your phone. Enter your PIN to pay."} />
                <Choice checked={method === 'Cash on Delivery'} onSelect={() => setMethod('Cash on Delivery')} icon={Banknote} title={delivery ? 'Cash on delivery' : 'Cash at pickup'} note={delivery ? 'Pay the rider when your order arrives' : 'Pay the shop when you collect'} />
              </div>
            </Section>

            {/* Summary */}
            <section aria-label="Order summary" className="rounded-3xl border border-border bg-card p-4 shadow-card">
              <dl className="space-y-1.5 text-[13.5px]">
                <div className="flex justify-between"><dt className="text-muted-foreground">Items ({totals.itemCount})</dt><dd className="font-semibold">{ksh(totals.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{delivery ? 'Delivery' : 'Pickup'}</dt><dd className="font-semibold">{totals.deliveryFee ? ksh(totals.deliveryFee) : 'Free'}</dd></div>
                <div className="flex justify-between border-t border-border pt-2 text-[16px]"><dt className="font-extrabold">Total</dt><dd className="font-extrabold">{ksh(totals.total)}</dd></div>
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />Prices and stock are checked again when you place your order.</p>
            </section>

            {showErrors && blockers.length > 0 && (
              <div data-checkout-issues role="alert" className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-[13px] font-extrabold">Before you place your order</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px]">{blockers.map(b => <li key={b}>{b}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </main>

      {!loading && !empty && !catalog.isError && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-nav backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <div className="mx-auto max-w-xl px-3 pt-3">
            {error && <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-2xl bg-destructive/10 px-3 py-2 text-[12.5px] font-semibold text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <button type="button" onClick={() => void place()} disabled={saving}
              className="flex h-14 w-full items-center justify-between rounded-full bg-primary px-6 text-primary-foreground shadow-card transition active:scale-[0.99] disabled:opacity-70">
              <span className="text-[15px] font-extrabold">{saving ? 'Placing your order…' : 'Place order'}</span>
              <span className="flex items-center gap-2 text-[15px] font-extrabold">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : ksh(totals.total)}</span>
            </button>
            <p className="mt-1.5 text-center text-[11.5px] text-muted-foreground">No account needed. Follow your order from this phone.</p>
          </div>
        </div>
      )}
    </div>
  );
}
