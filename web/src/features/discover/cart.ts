const STORAGE_KEY = "beez.guest-cart.v1";
const MAX_CART_LINES = 100;

export type CartLine = {
  productId: string;
  name: string;
  unit: string | null;
  zoneId: string;
  zoneName: string;
  shopName: string;
  shopSlug: string;
  qty: number;
};

export type CartProduct = Omit<CartLine, "qty">;

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(isCartLine);
  } catch {
    return [];
  }
}

export function addCartProduct(product: CartProduct): "added" | "different-zone" | "cart-full" {
  const cart = readCart();
  if (cart.length && cart[0].zoneId !== product.zoneId) return "different-zone";
  const existing = cart.find((line) => line.productId === product.productId);
  if (existing) existing.qty = Math.min(1000, existing.qty + 1);
  else {
    if (cart.length >= MAX_CART_LINES) return "cart-full";
    cart.push({ ...product, qty: 1 });
  }
  writeCart(cart);
  return "added";
}

export function updateCartQuantity(productId: string, qty: number): CartLine[] {
  const cart = readCart()
    .map((line) =>
      line.productId === productId ? { ...line, qty: Math.max(0, Math.min(1000, qty)) } : line,
    )
    .filter((line) => line.qty > 0);
  writeCart(cart);
  return cart;
}

export function clearCart() {
  writeCart([]);
}

function writeCart(cart: CartLine[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("beez-cart-change"));
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (!isRecord(value)) return false;
  const line = value;
  return (
    typeof line["productId"] === "string" &&
    typeof line["name"] === "string" &&
    (typeof line["unit"] === "string" || line["unit"] === null) &&
    typeof line["zoneId"] === "string" &&
    typeof line["zoneName"] === "string" &&
    typeof line["shopName"] === "string" &&
    typeof line["shopSlug"] === "string" &&
    typeof line["qty"] === "number" &&
    Number.isSafeInteger(line["qty"]) &&
    line["qty"] > 0 &&
    line["qty"] <= 1000
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
