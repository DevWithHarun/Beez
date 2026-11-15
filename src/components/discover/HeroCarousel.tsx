import { Link } from '@tanstack/react-router';
import { ArrowRight, Mic, Clapperboard } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { WhatsAppIcon, MobileMoneyIcon } from '@/components/brand-icons';
import heroWoman from '@/assets/discover-hero-woman.jpg';
import voiceImg from '@/assets/feature-voice-shopping.jpg';
import reelsImg from '@/assets/slide-reels.jpg';
import merchantVideoImg from '@/assets/slide-merchant-videos.jpg';
import whatsappImg from '@/assets/feature-whatsapp-commerce.jpg';
import moneyImg from '@/assets/slide-mobile-money.jpg';
import deliveryImg from '@/assets/slide-fast-delivery.jpg';

const WHATSAPP_URL = 'https://wa.me/';
const SLIDE_MS = 2000;

type IconType = ComponentType<{ className?: string }>;
const heroPills: { icon: IconType; label: [string, string]; circle: string }[] = [
  { icon: Mic, label: ['Voice AI', 'Shop & Sell'], circle: 'bg-tint-violet text-icon-violet' },
  { icon: Clapperboard, label: ['Reels', 'Discover'], circle: 'bg-icon-red text-ink-foreground' },
  { icon: WhatsAppIcon, label: ['WhatsApp', 'Orders'], circle: 'bg-icon-whatsapp text-ink-foreground' },
  { icon: MobileMoneyIcon, label: ['M-Pesa', 'Payments'], circle: 'bg-tint-mint' },
];

type Slide = {
  key: string;
  img: string;
  alt: string;
  pos?: string;
  top: string;
  title: string;
  desc: string;
  cta: string;
  to?: '/groceries' | '/get-started' | '/reel' | '/scan-pay' | '/track';
  href?: string;
  pills?: boolean;
};

const slides: Slide[] = [
  { key: 'discover', img: heroWoman, alt: 'Smiling woman shopping on her phone with Beez', pos: 'object-[45%_center]', top: 'Discover. Shop. Grow', title: 'with Beez!', desc: 'Voice commerce, reels, and fast delivery — all in one app.', cta: 'Start Shopping', to: '/groceries', pills: true },
  { key: 'voice', img: voiceImg, alt: 'Shopper ordering groceries by speaking into her phone', pos: 'object-[60%_center]', top: 'Just say it.', title: 'Voice AI', desc: 'Speak your order in Swahili, English or French — Beez builds your list.', cta: 'Talk to Beez', to: '/get-started' },
  { key: 'reels', img: reelsImg, alt: 'Young man showing a sneaker shopping reel with an add to cart button', pos: 'object-[70%_center]', top: 'Watch & shop', title: 'Reels', desc: 'Swipe short product videos and add to cart in one tap.', cta: 'Watch Reels', to: '/reel' },
  { key: 'merchant', img: merchantVideoImg, alt: 'Tailor recording a video introducing his fabric shop', pos: 'object-[75%_center]', top: 'Meet the seller', title: 'Merchant Videos', desc: 'Real shops introduce themselves and their products on video.', cta: 'See Shops', to: '/reel' },
  { key: 'whatsapp', img: whatsappImg, alt: 'Phone showing a WhatsApp chat turning into a confirmed order', pos: 'object-[50%_center]', top: 'Chat to order', title: 'WhatsApp', desc: 'Ask, order and get delivery updates right on WhatsApp.', cta: 'Open WhatsApp', href: WHATSAPP_URL },
  { key: 'money', img: moneyImg, alt: 'Shopper paying a market vendor with mobile money on her phone', pos: 'object-[70%_center]', top: 'Tap. Pay. Done.', title: 'Mobile Money', desc: 'Pay safely with M-Pesa and get instant confirmation.', cta: 'Scan & Pay', to: '/scan-pay' },
  { key: 'delivery', img: deliveryImg, alt: 'Delivery rider handing groceries to a customer with live tracking on his phone', pos: 'object-[70%_center]', top: 'At your door', title: 'Fast Delivery', desc: 'Track your rider live from the shop to your doorstep.', cta: 'Track Order', to: '/track' },
];

function SlideCard({ s, eager }: { s: Slide; eager: boolean }) {
  const ctaCls = 'mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-extrabold text-primary-foreground';
  const cta = <>{s.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.6} /></>;
  return (
    <div className="relative h-full w-full shrink-0 overflow-hidden">
      <img src={s.img} alt={s.alt} loading={eager ? 'eager' : 'lazy'} className={'absolute inset-y-0 right-0 h-full w-[78%] object-cover ' + (s.pos ?? '')} />
      <div className="discover-hero-fade absolute inset-0" />
      <div className={'relative flex h-full flex-col justify-center pl-3.5 ' + (s.pills ? 'max-w-[70%] min-[380px]:max-w-[58%]' : 'max-w-[60%]')}>
        <h2 className="font-extrabold leading-[1.02] tracking-tight">
          <span className="block whitespace-nowrap text-[19px]">{s.top}</span>
          <span className="block text-[25px] text-primary">{s.title}</span>
        </h2>
        <p className="mt-1.5 text-[11.5px] leading-snug opacity-95">{s.desc}</p>
        {s.href
          ? <a href={s.href} target="_blank" rel="noreferrer" className={ctaCls}>{cta}</a>
          : <Link to={s.to!} className={ctaCls}>{cta}</Link>}
      </div>
      {s.pills && (
        <ul className="absolute right-1.5 top-1.5 hidden flex-col gap-1 min-[380px]:flex">
          {heroPills.map(({ icon: I, label, circle }) => (
            <li key={label[0]} className="flex w-[5.6rem] items-center gap-1 rounded-full bg-card py-1 pl-1 pr-1.5 text-foreground shadow-card">
              <span className={'grid h-6 w-6 shrink-0 place-items-center rounded-full ' + circle}><I className="h-3.5 w-3.5" /></span>
              <span className="whitespace-nowrap text-[8.5px] font-semibold leading-[1.1]">{label[0]}<br />{label[1]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeroCarousel() {
  // Track holds every slide plus a copy of the first, so the last slide
  // (Fast Delivery) also slides right-to-left back into Discover.
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => { setAnimate(true); setPos(p => p + 1); }, SLIDE_MS + (animate ? 700 : 0));
    return () => clearTimeout(t);
  }, [pos, paused, animate]);

  const onEnd = () => {
    if (pos >= n) { setAnimate(false); setPos(0); }
  };

  const active = pos % n;
  const track: Slide[] = [...slides, slides[0]!];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Beez features"
      className="relative mt-2.5 h-[11.75rem] overflow-hidden rounded-[1.4rem] bg-ink text-ink-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className={'flex h-full ' + (animate ? 'transition-transform duration-700 ease-in-out' : '')}
        style={{ transform: `translateX(-${pos * 100}%)` }}
        onTransitionEnd={onEnd}
      >
        {track.map((s, i) => (
          <div key={s.key + i} className="h-full w-full shrink-0" aria-hidden={i % n !== active || (i === n && pos !== n)}>
            <SlideCard s={s} eager={i === 0} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Show ${s.title}`}
            aria-current={i === active}
            onClick={() => { setAnimate(true); setPos(i); }}
            className={'h-1.5 rounded-full transition-all ' + (i === active ? 'w-4 bg-ink-foreground' : 'w-1.5 bg-ink-foreground/50')}
          />
        ))}
      </div>
    </section>
  );
}
