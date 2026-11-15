import { Link } from '@tanstack/react-router';
import { ArrowLeft, Compass, Navigation, Store, Truck, ShoppingCart, Minus, Plus, MapPin, ChevronDown, ShieldCheck, Hexagon as Bee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarketplace } from './store';
import produce from '@/assets/market-produce.jpg';
import { productCell, type ShopProduct } from '@/lib/marketplace';
import { customerImageLabel, type ImageOrigin } from '@/lib/photo-studio';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyRoles } from '@/lib/identity.functions';
import { getAccountSession } from '@/lib/guest-session';
export function useWorkspaceRoles() {
  return useQuery({
    queryKey: ['my-workspace'],
    queryFn: async () => {
      if (!(await getAccountSession())) return null; // guest shoppers count as signed out
      return getMyRoles();
    },
    staleTime: 60_000,
    retry: false,
  });
}
export function BottomNav({ active = 'Discover' }: { active?: 'Discover' | 'Track' | 'none' }) {
  return <nav aria-label="Primary" className="market-bottom"><div>{[{ icon: Compass, label: 'Discover', to: '/discover' as const }, { icon: Navigation, label: 'Track', to: '/track' as const }, { icon: Store, label: 'Sell', to: '/merchant/dashboard' as const }, { icon: Truck, label: 'Delivery', to: '/rider/dashboard' as const }].map(({ icon: Icon, label, to }) => <Button key={label} asChild variant="ghost" aria-current={active === label ? 'page' : undefined} className={active === label ? 'market-tab active' : 'market-tab'}><Link to={to}><Icon /><span>{label}</span></Link></Button>)}</div></nav>;
}
export function Brand() { return <div className="market-brand"><span><Bee /></span>Bee<span className="text-primary">z</span></div>; }
export function Shell({ children, active = 'Discover', wide = false, showNav = true, landing = false, bottomBar }: { children: ReactNode; active?: 'Discover' | 'Track'; wide?: boolean; showNav?: boolean; landing?: boolean; bottomBar?: ReactNode }) { return <div className={`market-app ${wide ? 'market-wide' : ''} ${showNav ? '' : 'market-no-nav'} ${landing ? 'landing' : ''}`}><main className="market-main">{children}</main>{showNav && <BottomNav active={active} />}{bottomBar}</div>; }
export function MarketHeader({ title, back = '/discover', cart = false, children }: { title: string; back?: '/discover' | '/cart' | '/checkout' | '/track'; cart?: boolean; children?: ReactNode }) {
  const { cart: items } = useMarketplace(); const count = Object.values(items).reduce((s, n) => s + n, 0);
  return <header className="market-header"><Button asChild variant="ghost" size="icon" aria-label="Go back"><Link to={back}><ArrowLeft /></Link></Button><h1>{title}</h1><div className="ml-auto flex items-center gap-2">{children}{cart && <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Cart, ${count} items`}><Link to="/cart"><ShoppingCart />{count > 0 && <span className="market-count">{count}</span>}</Link></Button>}</div></header>;
}
export function Photo({ product, className = '' }: { product: { id: string; name: string; imageUrl?: string | null; imageOrigin?: string | null }; className?: string }) {
  const label = product.imageUrl ? customerImageLabel(product.imageOrigin as ImageOrigin | null | undefined) : null;
  return <div className={`produce-photo cell-${productCell(product.id)} ${className}`}><img src={product.imageUrl || produce} alt={product.name} width={1536} height={1024} loading="lazy" />{label && <span className="produce-photo-label" title={label}>{product.imageOrigin === 'ai_presentation' ? 'AI-styled' : 'AI touched-up'}</span>}</div>;
}
export function Stepper({ value, onChange, unit = '', max = Number.POSITIVE_INFINITY }: { value: number; onChange: (delta: number) => void; unit?: string; max?: number }) { return <div className="market-stepper"><Button variant="ghost" size="icon" aria-label="Decrease quantity" disabled={value <= 1} onClick={() => onChange(-1)}><Minus /></Button><span>{value} {unit}</span><Button variant="ghost" size="icon" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(1)}><Plus /></Button></div>; }
export function Location() { const { address, setAddress } = useMarketplace(); return <label className="market-location"><MapPin /><select aria-label="Shopping location" value={address} onChange={e => setAddress(e.target.value)}><option>Mombasa, Kenya</option><option>Mombasa, Kizingo</option><option>Mombasa, Nyali</option></select><ChevronDown /></label>; }
export function SafeNote({ children = 'Your information is safe and secure.' }: { children?: ReactNode }) { return <p className="market-safe"><ShieldCheck />{children}</p>; }
export function Money({ value }: { value: number }) { return <span>KES {value.toLocaleString()}</span>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="market-empty"><ShoppingCart /><h2>{title}</h2>{children}</div>; }
export type { ShopProduct };
