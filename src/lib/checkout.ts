// Pure checkout rules shared by the checkout page and its tests.
import { DELIVERY_FEE } from './marketplace';

export const DELIVERY_AREAS = ['Nyali', 'Kizingo', 'Bamburi', 'Likoni', 'Tudor', 'Kongowea', 'Mombasa CBD'] as const;
export type CheckoutPayMethod = 'M-Pesa' | 'Cash on Delivery';
export const INSTRUCTIONS_MAX = 300;

/** Kenyan mobile number in +2547XXXXXXXX / +2541XXXXXXXX form, or null if it isn't one. */
export function kenyanMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[17]\d{8}$/.test(digits) ? `+254${digits}` : null;
}

/** "Blue gate, Nyali, Mombasa" — the area name stays in so the map pin can be found. */
export function deliveryAddress(area: string, details: string): string {
  const extra = details.trim().replace(/\s+/g, ' ');
  return [extra, area, area === 'Mombasa CBD' ? '' : 'Mombasa'].filter(Boolean).join(', ');
}

export type CheckoutLine = { id: string; name: string; price: number; quantity: number; stock: number };

export function checkoutTotals(lines: CheckoutLine[], delivery: boolean) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const deliveryFee = delivery && lines.length > 0 ? DELIVERY_FEE : 0;
  return { subtotal, itemCount, deliveryFee, total: subtotal + deliveryFee };
}

export type CheckoutState = {
  lines: CheckoutLine[];
  missing: number;
  shopOpen: boolean | null;
  delivery: boolean;
  area: string;
  name: string;
  phone: string;
};

/** Everything that must be fixed before the order can be placed, in page order. */
export function checkoutBlockers(s: CheckoutState): string[] {
  if (s.lines.length === 0 && s.missing === 0) return ['Your cart is empty.'];
  const out: string[] = [];
  if (s.missing > 0) out.push('Some items are no longer sold. Remove them to continue.');
  for (const l of s.lines) {
    if (l.stock <= 0) out.push(`${l.name} is sold out. Remove it to continue.`);
    else if (l.quantity > l.stock) out.push(`Only ${l.stock} ${l.name} left. Lower the quantity to continue.`);
  }
  if (s.shopOpen === false) out.push('This shop is closed right now. Try again when it opens.');
  if (s.delivery && !s.area) out.push('Choose your delivery area.');
  if (s.name.trim().length < 2) out.push('Add your name so the shop and rider know who the order is for.');
  if (!kenyanMobile(s.phone)) out.push('Add a valid Kenyan phone number, like 0712 345 678.');
  return out;
}
