import { createContext, useContext, useState, type ReactNode } from 'react';
import { changeQuantity, type Cart } from '@/lib/marketplace';
type Store = { cart: Cart; change: (id: string, delta: number) => void; clear: () => void; delivery: boolean; setDelivery: (value: boolean) => void; address: string; setAddress: (value: string) => void; instructions: string; setInstructions: (value: string) => void };
const StoreContext = createContext<Store | null>(null);
export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [delivery, setDelivery] = useState(true);
  const [address, setAddress] = useState('Mombasa, Kenya');
  const [instructions, setInstructions] = useState('');
  return <StoreContext.Provider value={{ cart, change: (id, delta) => setCart(current => changeQuantity(current, id, delta)), clear: () => setCart({}), delivery, setDelivery, address, setAddress, instructions, setInstructions }}>{children}</StoreContext.Provider>;
}
export function useMarketplace() { const value = useContext(StoreContext); if (!value) throw new Error('Marketplace provider is missing'); return value; }
