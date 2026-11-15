import { describe, expect, it } from 'vitest';
import { browse, DEPARTMENTS, departmentCounts, departmentOf } from '@/lib/categories';
import type { ShopProduct } from '@/lib/marketplace';

const p = (id: string, name: string, category: string, price: number, stock = 5): ShopProduct =>
  ({ id, name, category, price, stock, merchantName: 'Mama Mboga', imageUrl: null });

const catalog = [
  p('1', 'Tomatoes', 'Food and Beverages', 140),
  p('2', 'Ripe Bananas', 'Food and Beverages', 60),
  p('3', 'Pishori Rice 2kg', 'Food and Beverages', 380),
  p('4', 'Fresh Milk 500ml', 'Dairy', 65, 0),
  p('5', 'Phone charger', 'Accessories', 450),
  p('6', 'Kitenge dress', 'Clothing', 1200),
  p('7', 'Mystery box', 'Gifts', 999),
];

describe('departmentOf', () => {
  it('uses the product name before the merchant category', () => {
    expect(departmentOf(catalog[0]!)).toBe('groceries-fresh-food');
    expect(departmentOf(catalog[1]!)).toBe('groceries-fresh-food');
    expect(departmentOf(catalog[2]!)).toBe('groceries-fresh-food');
  });
  it('falls back to the merchant category text', () => {
    expect(departmentOf(p('x', 'Sunrise pack', 'Food and Beverages', 1))).toBe('groceries-fresh-food');
    expect(departmentOf(p('x', 'Blue shirt', 'Clothing', 1))).toBe('fashion');
    expect(departmentOf(p('x', 'Gift', 'Clothing', 1))).toBe('fashion');
  });
  it('puts unknown products in More', () => {
    expect(departmentOf(catalog[6]!)).toBe('other');
  });
});

describe('department order', () => {
  it('shows the requested categories in order', () => {
    expect(DEPARTMENTS.map(d => d.label)).toEqual([
      'Electronics', 'Fashion', 'Home and Kitchen', 'Furniture', 'Groceries and Fresh Food',
      'Health and Beauty', 'Baby and Kids', 'Toys and Games', 'Sports and Outdoors', 'Automotive',
      'Books', 'Music', 'Movies', 'Tools and Garden', 'Office Supplies', 'Pet Supplies',
      'Services', 'Digital Goods', 'Gift Cards', 'More',
    ]);
  });

  it('classifies products into every requested category', () => {
    const examples: [string, string, string][] = [
      ['Phone', 'Electronics', 'electronics'],
      ['Leather shoes', 'Fashion', 'fashion'],
      ['Kitchen kettle', 'Home and Kitchen', 'home-kitchen'],
      ['Oak chair', 'Furniture', 'furniture'],
      ['Tomatoes', 'Groceries and Fresh Food', 'groceries-fresh-food'],
      ['Shampoo', 'Health and Beauty', 'health-beauty'],
      ['Baby bottle', 'Baby and Kids', 'baby-kids'],
      ['Puzzle kit', 'Toys and Games', 'toys-games'],
      ['Football', 'Sports and Outdoors', 'sports-outdoors'],
      ['Floor mats', 'Automotive', 'automotive'],
      ['Hardcover novel', 'Books', 'books'],
      ['Acoustic guitar', 'Music', 'music'],
      ['DVD movie', 'Movies', 'movies'],
      ['Garden trowel', 'Tools and Garden', 'tools-garden'],
      ['Office stapler', 'Office Supplies', 'office-supplies'],
      ['Dog leash', 'Pet Supplies', 'pet-supplies'],
      ['Hair salon', 'Services', 'services'],
      ['eBook download', 'Digital Goods', 'digital-goods'],
      ['Gift card', 'Gift Cards', 'gift-cards'],
    ];
    for (const [name, category, expected] of examples) {
      expect(departmentOf(p(name, name, category, 1)), name).toBe(expected);
    }
  });
});

describe('departmentCounts', () => {
  it('counts each product once', () => {
    const c = departmentCounts(catalog);
    expect(c['groceries-fresh-food']).toBe(4);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(catalog.length);
  });
});

describe('browse', () => {
  const base = { department: 'all' as const, query: '', sort: 'popular' as const, inStockOnly: false };
  it('filters by department', () => {
    expect(browse(catalog, { ...base, department: 'groceries-fresh-food' }).map(x => x.id)).toEqual(['1', '2', '3', '4']);
  });
  it('searches names, merchants and Swahili names', () => {
    expect(browse(catalog, { ...base, query: 'rice' }).map(x => x.id)).toEqual(['3']);
    expect(browse(catalog, { ...base, query: 'nyanya' }).map(x => x.id)).toEqual(['1']);
    expect(browse(catalog, { ...base, query: 'mama' })).toHaveLength(catalog.length);
  });
  it('hides sold-out items when asked', () => {
    expect(browse(catalog, { ...base, inStockOnly: true }).some(x => x.id === '4')).toBe(false);
  });
  it('sorts by price both ways and keeps sold-out last by default', () => {
    expect(browse(catalog, { ...base, sort: 'price-asc' })[0]!.id).toBe('2');
    expect(browse(catalog, { ...base, sort: 'price-desc' })[0]!.id).toBe('6');
    expect(browse(catalog, base).at(-1)!.id).toBe('4');
  });
});
