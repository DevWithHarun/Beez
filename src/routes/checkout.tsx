import { createFileRoute, Link } from '@tanstack/react-router';
import { Truck, Store, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, MarketHeader, SafeNote, Shell } from '@/components/marketplace/shared';
import { useMarketplace } from '@/components/marketplace/store';

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Checkout | Beez' }, { name: 'description', content: 'Choose delivery or pickup.' }, { property: 'og:title', content: 'Checkout | Beez' }, { property: 'og:description', content: 'Complete your order.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Checkout,
});
function Checkout() {
  const { cart, delivery, setDelivery, address, setAddress, instructions, setInstructions } = useMarketplace();
  if (!Object.keys(cart).length) return <Shell><MarketHeader title="Checkout" back="/cart" /><Empty title="Nothing to check out"><Button asChild className="market-cta"><Link to="/groceries">Shop now</Link></Button></Empty></Shell>;
  return <Shell><MarketHeader title="Checkout" back="/cart" /><h2 className="font-bold">Delivery Option</h2>
    <label className="market-option"><input type="radio" name="opt" checked={delivery} onChange={() => setDelivery(true)} /><Truck /><span className="flex-1">Delivery<small>Get it delivered to your location</small></span><b>KES 50</b></label>
    <label className="market-option"><input type="radio" name="opt" checked={!delivery} onChange={() => setDelivery(false)} /><Store /><span className="flex-1">Pickup<small>Collect from vendor</small></span><b>Free</b></label>
    {delivery && <label className="market-field"><b className="text-sm">Delivery Address</b><span className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4" /><input className="!pl-9" value={address} onChange={e => setAddress(e.target.value)} /></span></label>}
    <label className="market-field"><b className="text-sm">Delivery Instructions <span className="font-normal text-muted-foreground">(Optional)</span></b><textarea rows={2} placeholder="e.g. Call before delivery, Landmark..." value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
    <Button asChild className="market-cta" disabled={delivery && !address.trim()}><Link to="/payment">Continue</Link></Button><SafeNote />
  </Shell>;
}
