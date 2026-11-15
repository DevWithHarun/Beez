import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cartShopConflict, changeQuantity, type Cart, type CartShop, type CartShops } from "@/lib/marketplace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PersistedCart = { cart: Cart; prices: Record<string, number>; shops?: CartShops };
export type ShopCartItem = { id: string; price: number; quantity?: number } & CartShop;
type PendingAdd = { item: ShopCartItem; current: CartShop; onAdded?: (() => void) | undefined };
type Store = {
  cart: Cart;
  prices: Record<string, number>;
  change: (id: string, delta: number, price?: number) => void;
  acceptPrice: (id: string, price: number) => void;
  /** Which shop each cart product came from (when known). */
  shops: CartShops;
  /**
   * Adds one of a product while keeping one shop per order. If the cart holds
   * another shop's items, asks the shopper first and returns "asked".
   */
  addFromShop: (item: ShopCartItem, onAdded?: () => void) => "added" | "asked";
  clear: () => void;
  delivery: boolean;
  setDelivery: (value: boolean) => void;
  address: string;
  setAddress: (value: string) => void;
  instructions: string;
  setInstructions: (value: string) => void;
  ready: boolean;
  syncing: boolean;
  syncError: string | null;
};

const STORAGE_KEY = "beez-marketplace-cart-v1";
const StoreContext = createContext<Store | null>(null);

function parseCart(value: string | null): PersistedCart {
  if (!value) return { cart: {}, prices: {} };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") return { cart: {}, prices: {} };
  const record = parsed as Record<string, unknown>;
  const sourceCart =
    record["cart"] && typeof record["cart"] === "object"
      ? (record["cart"] as Record<string, unknown>)
      : record;
  const sourceShops =
    record["shops"] && typeof record["shops"] === "object"
      ? (record["shops"] as Record<string, unknown>)
      : {};
  const sourcePrices =
    record["prices"] && typeof record["prices"] === "object"
      ? (record["prices"] as Record<string, unknown>)
      : {};
  const cart: Cart = {};
  const prices: Record<string, number> = {};
  const shops: CartShops = {};
  for (const [id, quantity] of Object.entries(sourceCart)) {
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) continue;
    cart[id] = Math.min(quantity, 99);
    const price = sourcePrices[id];
    if (typeof price === "number" && Number.isFinite(price) && price >= 0) prices[id] = price;
    const shop = sourceShops[id] as Partial<CartShop> | undefined;
    if (shop && typeof shop.merchantId === "string" && typeof shop.merchantName === "string") {
      shops[id] = { merchantId: shop.merchantId, merchantName: shop.merchantName };
    }
  }
  return { cart, prices, shops };
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [basket, setBasket] = useState<PersistedCart>({ cart: {}, prices: {}, shops: {} });
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [delivery, setDelivery] = useState(true);
  const [address, setAddress] = useState("Mombasa, Kenya");
  const [instructions, setInstructions] = useState("");
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const userId = useRef<string | null>(null);
  const remoteReady = useRef(false);

  useEffect(() => {
    try {
      const saved = parseCart(window.localStorage.getItem(STORAGE_KEY));
      setBasket(saved);
    } catch (error) {
      console.error("The saved cart could not be read.", error);
      setSyncError("Your saved cart could not be read on this device.");
    } finally {
      setReady(true);
    }

    const loadRemoteCart = async (id: string) => {
      const { data, error } = await supabase
        .from("customer_cart_items")
        .select("product_id, quantity, unit_price_kes")
        .eq("customer_id", id);
      if (error) {
        console.error("The saved database cart could not be loaded.", error);
        setSyncError("Your saved cart could not be loaded from your account.");
        return;
      }

      userId.current = id;
      const remoteCart: Cart = {};
      const remotePrices: Record<string, number> = {};
      for (const item of data ?? []) {
        remoteCart[item.product_id] = item.quantity;
        remotePrices[item.product_id] = item.unit_price_kes;
      }
      setBasket((current) => {
        const merged = { ...remotePrices };
        const mergedCart = { ...remoteCart };
        for (const [productId, quantity] of Object.entries(current.cart)) {
          mergedCart[productId] = Math.max(mergedCart[productId] ?? 0, quantity);
          if (quantity >= (remoteCart[productId] ?? 0) && current.prices[productId] !== undefined) {
            merged[productId] = current.prices[productId]!;
          }
        }
        return { cart: mergedCart, prices: merged, shops: current.shops ?? {} };
      });
      remoteReady.current = true;
      setSyncError(null);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        userId.current = null;
        remoteReady.current = true;
        return;
      }
      remoteReady.current = false;
      window.setTimeout(() => void loadRemoteCart(session.user.id), 0);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket satisfies PersistedCart));
    } catch (error) {
      console.error("The cart could not be saved on this device.", error);
      setSyncError("Your cart could not be saved on this device.");
    }
  }, [basket, ready]);

  useEffect(() => {
    const id = userId.current;
    if (!ready || !remoteReady.current || !id) return;
    const timeout = window.setTimeout(() => {
      setSyncing(true);
      const items = Object.entries(basket.cart).map(([productId, quantity]) => ({
        product_id: productId,
        quantity,
        unit_price_kes: basket.prices[productId] ?? 0,
      }));
      void supabase.rpc("sync_customer_cart", { _items: items }).then(({ error }) => {
        if (error) {
          console.error("The cart could not be synchronized with your account.", error);
          setSyncError("Your cart could not be synchronized with your account.");
        } else {
          setSyncError(null);
        }
        setSyncing(false);
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [basket, ready]);

  const change = (id: string, delta: number, price?: number) => {
    setBasket((current) => {
      const currentQuantity = current.cart[id] ?? 0;
      const quantity = Math.max(0, currentQuantity + delta);
      if (quantity > 99) return current;
      const cart = changeQuantity(current.cart, id, delta);
      const prices = { ...current.prices };
      const shops = { ...(current.shops ?? {}) };
      if (currentQuantity === 0 && quantity > 0 && price !== undefined) prices[id] = price;
      if (quantity === 0) {
        delete prices[id];
        delete shops[id];
      }
      return { cart, prices, shops };
    });
  };
  const clear = () => {
    setBasket({ cart: {}, prices: {}, shops: {} });
  };
  const addNow = (item: ShopCartItem, fresh: boolean) => {
    setBasket((current) => {
      const base = fresh ? { cart: {}, prices: {}, shops: {} } : current;
      const currentQuantity = base.cart[item.id] ?? 0;
      const quantity = Math.min(99, currentQuantity + Math.max(1, item.quantity ?? 1));
      if (quantity === currentQuantity) return base;
      return {
        cart: { ...base.cart, [item.id]: quantity },
        prices: currentQuantity === 0 ? { ...base.prices, [item.id]: item.price } : base.prices,
        shops: { ...(base.shops ?? {}), [item.id]: { merchantId: item.merchantId, merchantName: item.merchantName } },
      };
    });
  };
  const addFromShop = (item: ShopCartItem, onAdded?: () => void): "added" | "asked" => {
    const current = cartShopConflict(basket.cart, basket.shops ?? {}, item.merchantId);
    if (current) {
      setPendingAdd({ item, current, onAdded });
      return "asked";
    }
    addNow(item, false);
    onAdded?.();
    return "added";
  };
  const acceptPrice = (id: string, price: number) => {
    setBasket((current) => ({ ...current, prices: { ...current.prices, [id]: price } }));
  };

  return (
    <StoreContext.Provider
      value={{
        cart: basket.cart,
        prices: basket.prices,
        change,
        acceptPrice,
        shops: basket.shops ?? {},
        addFromShop,
        clear,
        delivery,
        setDelivery,
        address,
        setAddress,
        instructions,
        setInstructions,
        ready,
        syncing,
        syncError,
      }}
    >
      {children}
      <AlertDialog open={!!pendingAdd} onOpenChange={(open) => !open && setPendingAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {pendingAdd?.current.merchantName}. Each order comes from one
              shop, so adding from {pendingAdd?.item.merchantName} will empty your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAdd) return;
                addNow(pendingAdd.item, true);
                pendingAdd.onAdded?.();
                setPendingAdd(null);
              }}
            >
              Start new cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StoreContext.Provider>
  );
}

export function useMarketplace() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Marketplace provider is missing");
  return value;
}
