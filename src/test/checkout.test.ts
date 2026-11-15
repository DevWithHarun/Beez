import { describe, expect, it } from 'vitest';
import { checkoutBlockers, checkoutTotals, deliveryAddress, kenyanMobile, type CheckoutState } from '@/lib/checkout';

const line = { id: 'a', name: 'Tomatoes', price: 140, quantity: 2, stock: 10 };
const ok: CheckoutState = { lines: [line], missing: 0, shopOpen: true, delivery: true, area: 'Nyali', name: 'Amina', phone: '0712345678' };

describe('checkout totals', () => {
  it('adds the KSh 50 delivery fee for delivery', () => {
    expect(checkoutTotals([line], true)).toEqual({ subtotal: 280, itemCount: 2, deliveryFee: 50, total: 330 });
  });
  it('charges no delivery fee for pickup', () => {
    expect(checkoutTotals([line], false).total).toBe(280);
  });
});

describe('kenyan phone numbers', () => {
  it('accepts 07, 01, +254 and spaced forms', () => {
    expect(kenyanMobile('0712 345 678')).toBe('+254712345678');
    expect(kenyanMobile('+254 112 345 678')).toBe('+254112345678');
    expect(kenyanMobile('712345678')).toBe('+254712345678');
  });
  it('rejects short or non-mobile numbers', () => {
    expect(kenyanMobile('071234')).toBeNull();
    expect(kenyanMobile('0212345678')).toBeNull();
  });
});

describe('delivery address', () => {
  it('keeps the area so the map pin can be found', () => {
    expect(deliveryAddress('Nyali', ' Blue  gate ')).toBe('Blue gate, Nyali, Mombasa');
    expect(deliveryAddress('Mombasa CBD', '')).toBe('Mombasa CBD');
  });
});

describe('checkout blockers', () => {
  it('lets a complete order through', () => {
    expect(checkoutBlockers(ok)).toEqual([]);
  });
  it('needs a delivery area only for delivery', () => {
    expect(checkoutBlockers({ ...ok, area: '' })).toContain('Choose your delivery area.');
    expect(checkoutBlockers({ ...ok, area: '', delivery: false })).toEqual([]);
  });
  it('blocks sold-out items, too-high quantities and closed shops', () => {
    expect(checkoutBlockers({ ...ok, lines: [{ ...line, stock: 0 }] })[0]).toMatch(/sold out/);
    expect(checkoutBlockers({ ...ok, lines: [{ ...line, stock: 1 }] })[0]).toMatch(/Only 1/);
    expect(checkoutBlockers({ ...ok, shopOpen: false })[0]).toMatch(/closed/);
  });
  it('requires a name and a valid phone', () => {
    expect(checkoutBlockers({ ...ok, name: ' ', phone: '123' })).toHaveLength(2);
  });
});
