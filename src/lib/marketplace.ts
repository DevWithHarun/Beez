// Pure helpers for the Beez marketplace. Catalogue data comes from Supabase.
export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  merchantName: string;
  imageUrl: string | null;
};
export type Cart = Record<string, number>;
export const DELIVERY_FEE = 50;

export function changeQuantity(cart: Cart, id: string, change: number): Cart {
  const next = { ...cart }; const quantity = Math.max(0, (next[id] ?? 0) + change);
  if (quantity === 0) delete next[id]; else next[id] = quantity;
  return next;
}

// Stable pseudo-photo variant derived from the product id.
export function productCell(id: string) { let h = 0; for (const c of id) h = (h + c.charCodeAt(0)) % 4; return h; }

export function subtotal(cart: Cart, catalog: ShopProduct[]) {
  return catalog.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0);
}

export type SummaryItem = { name: string; quantity: number };

// Order item lines are stored as "2 × Fresh Tomatoes, 1 × Onions".
export function parseItemsSummary(summary: string): SummaryItem[] {
  return summary.split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const [count, ...rest] = part.split('×');
    return { name: rest.join('×').trim() || part, quantity: Math.max(1, Math.round(Number(count?.trim())) || 1) };
  });
}
export function countItems(summary: string) { return parseItemsSummary(summary).reduce((a, i) => a + i.quantity, 0); }
export function firstItemName(summary: string) { return parseItemsSummary(summary)[0]?.name ?? 'Your order'; }
export function buildItemsSummary(items: { name: string; quantity: number }[]) { return items.map(i => `${i.quantity} × ${i.name}`).join(', '); }
export function orderProduct(order: { id: string; items_summary: string }) {
  return { id: order.id, name: firstItemName(order.items_summary) };
}

// Database statuses mapped to the labels customers see.
export function displayStatus(status: string) {
  switch (status) {
    case 'Delivered': return 'Delivered';
    case 'Cancelled': return 'Cancelled';
    case 'Out for Delivery': return 'Out for Delivery';
    default: return 'In Transit'; // Pending, Preparing, Ready for Pickup, Assigned, In Transit
  }
}
export function statusClass(status: string) {
  return status === 'Delivered' ? 'done' : status === 'Out for Delivery' ? 'out' : status === 'Cancelled' ? 'cancelled' : '';
}
export function filterOrders<T extends { id: string; status: string }>(orders: T[], status: string, query: string) {
  const q = query.replace('#', '').toLowerCase();
  return orders.filter(o => (status === 'All' || displayStatus(o.status) === status) && o.id.toLowerCase().includes(q));
}

// Rough map pins for Mombasa areas, used when placing an order.
const AREAS: [string, number, number][] = [
  ['kizingo', -4.0574, 39.6734], ['nyali', -4.0437, 39.6936], ['bamburi', -3.9955, 39.7119],
  ['likoni', -4.1043, 39.6598], ['tudor', -4.04, 39.666], ['kongowea', -4.013, 39.694],
  ['mombasa', -4.0435, 39.6682],
];
export function coordsFor(area: string): { lat: number; lng: number } {
  const value = area.toLowerCase();
  for (const [name, lat, lng] of AREAS) if (value.includes(name)) return { lat, lng };
  return { lat: -4.0435, lng: 39.6682 };
}
