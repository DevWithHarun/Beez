import { describe, expect, it } from 'vitest';
import { composeReply, linesNeedAi, matchProduct, mergeLines, parseSpokenList, toListLines, type CatalogEntry } from '@/lib/shopper-voice';

const catalog: CatalogEntry[] = [
  { id: 't-low', name: 'Tomatoes', category: 'Food', price: 140, stock: 0, merchantName: 'A' },
  { id: 't-ok', name: 'Tomatoes', category: 'Food', price: 140, stock: 7, merchantName: 'B' },
  { id: 'bread', name: 'White Bread Loaf', category: 'Bakery', price: 65, stock: 3, merchantName: 'C' },
  { id: 'milk', name: 'Fresh Milk 500ml', category: 'Dairy', price: 60, stock: 10, merchantName: 'C' },
];

describe('shopper spoken lists', () => {
  it('turns "2 kg tomatoes and a loaf of bread" into two items', () => {
    expect(parseSpokenList('2 kg tomatoes and a loaf of bread')).toEqual([
      { quantity: 2, phrase: 'tomatoes' },
      { quantity: 1, phrase: 'bread' },
    ]);
  });
  it('understands Kiswahili quantities after the product', () => {
    expect(parseSpokenList('Nataka nyanya kilo mbili na mkate mmoja')).toEqual([
      { quantity: 2, phrase: 'nyanya' },
      { quantity: 1, phrase: 'mkate' },
    ]);
  });
  it('understands French', () => {
    expect(parseSpokenList('deux kilos de tomates et un pain')).toEqual([
      { quantity: 2, phrase: 'tomates' },
      { quantity: 1, phrase: 'pain' },
    ]);
  });
  it('matches local words to products', () => {
    expect(matchProduct('nyanya', catalog)?.name).toBe('Tomatoes');
    expect(matchProduct('mkate', catalog)?.id).toBe('bread');
    expect(matchProduct('maziwa', catalog)?.id).toBe('milk');
  });
  it('picks the seller that has stock', () => {
    expect(matchProduct('tomatoes', catalog)?.id).toBe('t-ok');
  });
  it('never puts more in the list than is in stock', () => {
    const [line] = toListLines([{ quantity: 5, phrase: 'bread' }], catalog);
    expect(line).toMatchObject({ productId: 'bread', quantity: 3, limited: true });
  });
  it('marks products the shop does not have', () => {
    const [line] = toListLines([{ quantity: 1, phrase: 'sugar' }], catalog);
    expect(line?.productId).toBeNull();
  });
  it('only asks the AI when the rules cannot place everything', () => {
    const clear = toListLines(parseSpokenList('2 tomatoes and milk'), catalog);
    expect(linesNeedAi('2 tomatoes and milk', clear)).toBe(false);
    expect(linesNeedAi('what fruits do you have?', [])).toBe(true);
    expect(linesNeedAi('sugar', toListLines(parseSpokenList('sugar'), catalog))).toBe(true);
  });
  it('adds repeated requests together, capped at stock', () => {
    const first = toListLines([{ quantity: 2, phrase: 'bread' }], catalog);
    const merged = mergeLines(first, toListLines([{ quantity: 2, phrase: 'bread' }], catalog), catalog);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(3);
  });
  it('tells the shopper what was found and what is missing', () => {
    const lines = toListLines(parseSpokenList('2 tomatoes and sugar'), catalog);
    const reply = composeReply(lines, catalog, 'en');
    expect(reply).toContain('2 Tomatoes');
    expect(reply).toContain("sugar isn't available");
  });
});
