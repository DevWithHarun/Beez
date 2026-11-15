import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Home, LayoutGrid, Clapperboard, MessageCircleMore, MoreHorizontal, MapPin, Store, Motorbike, QrCode, Sparkles } from 'lucide-react';

type Tab = 'Home' | 'Categories' | 'Reels';

const WHATSAPP_URL = 'https://wa.me/';

function TabInner({ icon: Icon, label, active }: { icon: typeof Home; label: string; active: boolean }) {
  return (
    <>
      <span className={'grid h-11 w-[4.25rem] place-items-center rounded-full ' + (active ? 'bg-primary/25' : '')}>
        <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} />
      </span>
      <span className="text-[13px] font-bold leading-none">{label}</span>
      <span className={'mt-1 h-[3px] w-12 rounded-full ' + (active ? 'bg-primary' : 'bg-transparent')} />
    </>
  );
}

export function ShopBottomNav({ active }: { active: Tab }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const cls = 'flex w-full flex-col items-center gap-0.5 pt-1.5 text-foreground';
  const more = [
    { icon: MapPin, label: 'Track order', to: '/track' as const },
    { icon: Store, label: 'Sell on Beez', to: '/merchant/dashboard' as const },
    { icon: Motorbike, label: 'Deliver with Beez', to: '/rider/dashboard' as const },
    { icon: QrCode, label: 'Scan & Pay', to: '/scan-pay' as const },
    { icon: Sparkles, label: 'Welcome page', to: '/' as const },
  ];

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-50">
      <ul className="mx-auto grid max-w-3xl grid-cols-5 rounded-t-[1.75rem] bg-card px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-nav">
        <li><Link to="/discover" aria-current={active === 'Home' ? 'page' : undefined} className={cls}><TabInner icon={Home} label="Home" active={active === 'Home'} /></Link></li>
        <li><Link to="/groceries" aria-current={active === 'Categories' ? 'page' : undefined} className={cls}><TabInner icon={LayoutGrid} label="Categories" active={active === 'Categories'} /></Link></li>
        <li><Link to="/reel" aria-current={active === 'Reels' ? 'page' : undefined} className={cls}><TabInner icon={Clapperboard} label="Reels" active={active === 'Reels'} /></Link></li>
        <li><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className={cls}><TabInner icon={MessageCircleMore} label="Messages" active={false} /></a></li>
        <li ref={ref} className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} className={cls}>
            <TabInner icon={MoreHorizontal} label="More" active={false} />
          </button>
          {open && (
            <ul role="menu" className="absolute bottom-full right-1 mb-3 w-52 overflow-hidden rounded-2xl border bg-card py-1.5 shadow-panel">
              {more.map(({ icon: I, label, to }) => (
                <li key={label} role="none">
                  <Link role="menuitem" to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
                    <I className="h-5 w-5" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}
