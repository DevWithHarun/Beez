import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Loader2, Minus, Plus, X, ShoppingCart, Volume2, VolumeX, Send, Check, CircleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Photo } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';
import { useCatalog } from '@/lib/shop-data';
import { mergeLines, type CatalogEntry, type ListLine, type ShopperLanguage } from '@/lib/shopper-voice';
import { askShopperAssistant, transcribeShopperSpeech } from '@/lib/shopper-voice.functions';
import { getRecognitionCtor, recordClip, recordingSupported } from '@/components/order-agent/speech';
import beezMark from '@/assets/beez-mark.png';

const LANGS: { code: ShopperLanguage; label: string; speech: string }[] = [
  { code: 'en', label: 'English', speech: 'en-KE' },
  { code: 'sw', label: 'Kiswahili', speech: 'sw-KE' },
  { code: 'fr', label: 'Français', speech: 'fr-FR' },
];

const COPY = {
  en: { title: 'Talk to Beez', hint: 'Say what you need, like "2 kg tomatoes and a loaf of bread".', listening: 'Listening… speak now', thinking: 'Finding your products…', tap: 'Tap the mic and speak', type: 'Or type your list…', add: 'Add to cart', added: 'Added to your cart!', viewCart: 'View cart', more: 'Say more', missing: 'Not available yet', onlyLeft: (n: number) => `Only ${n} left`, empty: 'Your list will appear here.', blocked: 'Microphone access is blocked. Allow the microphone in your browser, or type your list below.', nothingHeard: "Beez didn't catch that. Please try again or type your list.", noMic: "This browser can't use the microphone. Type your list below instead." },
  sw: { title: 'Ongea na Beez', hint: 'Sema unachohitaji, kama "nyanya kilo mbili na mkate mmoja".', listening: 'Nakusikiliza… ongea sasa', thinking: 'Natafuta bidhaa zako…', tap: 'Bonyeza maikrofoni uongee', type: 'Au andika orodha yako…', add: 'Weka kwenye kikapu', added: 'Imewekwa kwenye kikapu!', viewCart: 'Ona kikapu', more: 'Ongeza zaidi', missing: 'Haipatikani bado', onlyLeft: (n: number) => `Zimebaki ${n}`, empty: 'Orodha yako itaonekana hapa.', blocked: 'Maikrofoni imezuiwa. Ruhusu maikrofoni kwenye kivinjari, au andika orodha yako hapa chini.', nothingHeard: 'Beez haikusikia vizuri. Jaribu tena au andika orodha yako.', noMic: 'Kivinjari hiki hakiwezi kutumia maikrofoni. Andika orodha yako hapa chini.' },
  fr: { title: 'Parlez à Beez', hint: 'Dites ce qu\'il vous faut, comme « 2 kg de tomates et un pain ».', listening: 'Je vous écoute… parlez', thinking: 'Je cherche vos produits…', tap: 'Touchez le micro et parlez', type: 'Ou écrivez votre liste…', add: 'Ajouter au panier', added: 'Ajouté au panier !', viewCart: 'Voir le panier', more: 'Ajouter encore', missing: 'Pas encore disponible', onlyLeft: (n: number) => `Plus que ${n}`, empty: 'Votre liste apparaîtra ici.', blocked: 'Le micro est bloqué. Autorisez le micro dans le navigateur, ou écrivez votre liste ci-dessous.', nothingHeard: "Beez n'a pas bien entendu. Réessayez ou écrivez votre liste.", noMic: 'Ce navigateur ne peut pas utiliser le micro. Écrivez votre liste ci-dessous.' },
} as const;

type Phase = 'idle' | 'listening' | 'recording' | 'thinking' | 'error';

function useShopperLang() {
  const [lang, setLang] = useState<ShopperLanguage>('en');
  useEffect(() => {
    const saved = localStorage.getItem('beez-lang');
    if (saved === 'en' || saved === 'sw' || saved === 'fr') setLang(saved);
  }, []);
  return [lang, (l: ShopperLanguage) => { setLang(l); localStorage.setItem('beez-lang', l); }] as const;
}

function speak(text: string, lang: ShopperLanguage) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const code = LANGS.find(l => l.code === lang)!.speech;
  u.lang = code;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(code.slice(0, 2)));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function ShopVoiceAssistant({ open, onOpenChange, listenOnOpen }: { open: boolean; onOpenChange: (o: boolean) => void; listenOnOpen: number }) {
  const [lang, setLang] = useShopperLang();
  const t = COPY[lang];
  const catalogQuery = useCatalog();
  const { cart, change } = useMarketplace();
  const ask = useServerFn(askShopperAssistant);
  const transcribe = useServerFn(transcribeShopperSpeech);

  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [lines, setLines] = useState<ListLine[]>([]);
  const [typed, setTyped] = useState('');
  const [muted, setMuted] = useState(false);
  const [added, setAdded] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const recorderMode = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const catalog: CatalogEntry[] = useMemo(
    () => (catalogQuery.data ?? []).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock, merchantName: p.merchantName })),
    [catalogQuery.data],
  );
  const products = catalogQuery.data ?? [];

  const handleText = async (text: string) => {
    const clean = text.trim();
    if (!clean) { setPhase('idle'); return; }
    setHeard(clean);
    setPhase('thinking');
    setError('');
    setAdded(false);
    try {
      const result = await ask({ data: { transcript: clean.slice(0, 300), language: lang } });
      setLines(current => mergeLines(current, result.lines, catalog));
      setReply(result.reply);
      setPhase('idle');
      if (!muted) speak(result.reply, lang);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setPhase('error');
    }
  };

  const recordAndTranscribe = async () => {
    try {
      setHeard('');
      setError('');
      setPhase('recording');
      const clip = await recordClip(stop => { stopRef.current = stop; }, 8000);
      stopRef.current = null;
      setPhase('thinking');
      const form = new FormData();
      form.append('audio', clip, 'speech.webm');
      form.append('language', lang);
      if (!openRef.current) { setPhase('idle'); return; }
      const { transcript } = await transcribe({ data: form });
      if (!transcript) { setError(t.nothingHeard); setPhase('error'); return; }
      await handleText(transcript);
    } catch (e) {
      const blocked = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      setError(blocked ? t.blocked : e instanceof Error ? e.message : t.nothingHeard);
      setPhase('error');
    }
  };

  const startListening = async () => {
    stopRef.current?.();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setError('');
    const Ctor = getRecognitionCtor();
    if (Ctor && !recorderMode.current) {
      const rec = new Ctor();
      rec.lang = LANGS.find(l => l.code === lang)!.speech;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      let failed = false;
      rec.onresult = (event) => {
        finalText = Array.from(event.results).map(r => r[0]?.transcript ?? '').join(' ').trim();
        setHeard(finalText);
      };
      rec.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        failed = true;
        if (event.error === 'not-allowed') { setError(t.blocked); setPhase('error'); return; }
        // The browser's own listener isn't working here (offline service,
        // language not supported…): record and let Beez transcribe instead.
        if (recordingSupported()) { recorderMode.current = true; void recordAndTranscribe(); return; }
        setError(t.nothingHeard);
        setPhase('error');
      };
      rec.onend = () => { stopRef.current = null; if (!failed && openRef.current) void handleText(finalText); else if (!failed) setPhase('idle'); };
      stopRef.current = () => rec.abort();
      setHeard('');
      setPhase('listening');
      try { rec.start(); } catch { setPhase('idle'); }
      return;
    }
    if (recordingSupported()) { await recordAndTranscribe(); return; }
    setError(t.noMic);
    setPhase('error');
  };

  const stopListening = () => stopRef.current?.();

  useEffect(() => {
    if (open && listenOnOpen) void startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenOnOpen]);

  useEffect(() => {
    if (open) return;
    stopRef.current?.();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setPhase('idle');
  }, [open]);

  const setQty = (i: number, delta: number) => setLines(ls => ls.map((l, j) => {
    if (j !== i) return l;
    const stock = products.find(p => p.id === l.productId)?.stock ?? 99;
    return { ...l, quantity: Math.max(1, Math.min(stock, l.quantity + delta)), limited: false };
  }));
  const remove = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));

  const available = lines.filter(l => l.productId && products.some(p => p.id === l.productId && p.stock > 0));
  const total = available.reduce((sum, l) => sum + (products.find(p => p.id === l.productId)?.price ?? 0) * l.quantity, 0);
  const count = available.reduce((sum, l) => sum + l.quantity, 0);

  const addAll = () => {
    for (const l of available) {
      const p = products.find(x => x.id === l.productId)!;
      const room = Math.max(0, Math.min(p.stock, 99) - (cart[p.id] ?? 0));
      const q = Math.min(l.quantity, room);
      if (q > 0) change(p.id, q, p.price);
    }
    setLines([]);
    setAdded(true);
  };

  const busy = phase === 'listening' || phase === 'recording';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="landing mx-auto flex max-h-[92vh] max-w-2xl flex-col gap-0 rounded-t-[1.75rem] p-0">
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <img src={beezMark} alt="" width={512} height={512} className="h-9 w-9 object-contain" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-lg font-extrabold leading-tight">{t.title}</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">{t.hint}</SheetDescription>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {LANGS.map(l => (
            <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={lang === l.code}
              className={'rounded-full border px-3 py-1 text-xs font-bold ' + (lang === l.code ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
              {l.label}
            </button>
          ))}
          <button type="button" onClick={() => { setMuted(m => !m); if (!muted && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }}
            aria-label={muted ? 'Turn voice replies on' : 'Turn voice replies off'} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-secondary">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {/* Mic */}
          <div className="flex flex-col items-center py-3">
            <button type="button" onClick={busy ? stopListening : () => void startListening()} disabled={phase === 'thinking'}
              aria-label={busy ? 'Stop listening' : 'Start speaking'}
              className={'relative grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-panel transition disabled:opacity-60 ' + (busy ? 'scale-105' : 'hover:scale-105')}>
              {busy && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
              {phase === 'thinking' ? <Loader2 className="relative h-8 w-8 animate-spin" /> : busy ? <Square className="relative h-7 w-7 fill-current" /> : <Mic className="relative h-9 w-9" strokeWidth={2.4} />}
            </button>
            <p className="mt-2 text-sm font-bold" aria-live="polite">
              {phase === 'listening' || phase === 'recording' ? t.listening : phase === 'thinking' ? t.thinking : lines.length || reply ? t.more : t.tap}
            </p>
          </div>

          {/* Conversation */}
          {heard && (
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm text-ink-foreground">“{heard}”</div>
          )}
          {reply && phase !== 'thinking' && (
            <div className="mt-2 flex max-w-[90%] gap-2">
              <img src={beezMark} alt="" width={512} height={512} className="mt-0.5 h-7 w-7 shrink-0 object-contain" />
              <p className="rounded-2xl rounded-tl-md bg-primary/15 px-3.5 py-2 text-sm">{reply}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-2xl bg-destructive/10 px-3.5 py-2 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
          )}

          {/* Shopping list */}
          {added && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-tint-mint px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-bold"><Check className="h-4 w-4" />{t.added}</span>
              <Link to="/cart" onClick={() => onOpenChange(false)} className="rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-ink-foreground">{t.viewCart}</Link>
            </div>
          )}
          {lines.length > 0 && (
            <ul className="mt-4 space-y-2">
              {lines.map((l, i) => {
                const p = l.productId ? products.find(x => x.id === l.productId) : undefined;
                if (!p) return (
                  <li key={'m' + i} className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary"><CircleAlert className="h-5 w-5 text-muted-foreground" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold capitalize">{l.heard}</p>
                      <p className="text-xs text-muted-foreground">{t.missing}</p>
                    </div>
                    <button type="button" onClick={() => remove(i)} aria-label={`Remove ${l.heard}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
                  </li>
                );
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-card">
                    <Photo product={p} className="!h-12 !w-12 shrink-0 overflow-hidden rounded-xl [&_img]:!h-full [&_img]:!w-full [&_img]:object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.merchantName} · KSh {p.price.toLocaleString()}</p>
                      {l.quantity >= p.stock && <p className="text-[11px] font-bold text-destructive">{t.onlyLeft(p.stock)}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(i, -1)} disabled={l.quantity <= 1} aria-label={`Fewer ${p.name}`} className="grid h-7 w-7 place-items-center rounded-full bg-secondary disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center font-extrabold" aria-label={`${l.quantity} ${p.name}`}>{l.quantity}</span>
                      <button type="button" onClick={() => setQty(i, 1)} disabled={l.quantity >= p.stock} aria-label={`More ${p.name}`} className="grid h-7 w-7 place-items-center rounded-full bg-secondary disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button type="button" onClick={() => remove(i)} aria-label={`Remove ${p.name}`} className="grid h-7 w-7 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          )}
          {!lines.length && !added && !heard && <p className="mt-2 text-center text-xs text-muted-foreground">{t.empty}</p>}
        </div>

        {/* Footer: type + add */}
        <div className="border-t border-border bg-background px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); const v = typed; setTyped(''); void handleText(v); }}>
            <input value={typed} onChange={e => setTyped(e.target.value)} maxLength={300} placeholder={t.type} aria-label={t.type}
              className="min-w-0 flex-1 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={!typed.trim() || phase === 'thinking'} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
          {available.length > 0 && (
            <button type="button" onClick={addAll} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-extrabold text-primary-foreground shadow-panel">
              <ShoppingCart className="h-5 w-5" /> {t.add} · {count} · KSh {total.toLocaleString()}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
