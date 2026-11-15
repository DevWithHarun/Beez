// Pure helpers for the shopper Categories page: sort each product into a
// department (merchants type their own category text), then search, filter
// and sort the catalogue. No data fetching here.

import type { ShopProduct } from '@/lib/marketplace';
import { SYNONYMS } from '@/lib/shopper-voice';

export type DepartmentId =
  | 'electronics' | 'fashion' | 'home-kitchen' | 'furniture' | 'groceries-fresh-food'
  | 'health-beauty' | 'baby-kids' | 'toys-games' | 'sports-outdoors' | 'automotive'
  | 'books' | 'music' | 'movies' | 'tools-garden' | 'office-supplies' | 'pet-supplies'
  | 'services' | 'digital-goods' | 'gift-cards' | 'other';

export type Department = { id: DepartmentId; label: string; blurb: string; nameWords: string[]; categoryWords: string[] };

// Order matters: product names are checked against every department first,
// then the merchant's category text, in this order.
export const DEPARTMENTS: Department[] = [
  { id: 'electronics', label: 'Electronics', blurb: 'Phones, laptops, audio and cameras',
    nameWords: ['phone', 'charger', 'cable', 'earphone', 'headphone', 'audio', 'speaker', 'radio', 'camera', 'laptop', 'computer', 'tablet', 'battery', 'bulb', 'solar', 'powerbank', 'simu'],
    categoryWords: ['electronic', 'phone', 'gadget', 'tech', 'electrical', 'computer', 'mobile', 'camera', 'audio'] },
  { id: 'fashion', label: 'Fashion', blurb: 'Clothing, shoes, bags and accessories',
    nameWords: ['shirt', 'dress', 'kitenge', 'kanga', 'kikoi', 'shoe', 'sandal', 'trouser', 'jeans', 'skirt', 'jacket', 'bag', 'handbag', 'watch', 'cap', 'hat', 'necklace', 'earring', 'nguo', 'viatu'],
    categoryWords: ['fashion', 'cloth', 'apparel', 'wear', 'shoe', 'textile', 'jewel', 'nguo', 'men', 'women', 'kids', 'bag'] },
  { id: 'home-kitchen', label: 'Home and Kitchen', blurb: 'Kitchenware and essentials for your home',
    nameWords: ['cookware', 'kitchen', 'pot', 'pan', 'plate', 'dish', 'cutlery', 'kettle', 'blender', 'mixer', 'utensil', 'mug', 'cup', 'bedding', 'curtain'],
    categoryWords: ['home and kitchen', 'home & kitchen', 'kitchenware', 'cookware', 'household', 'home'] },
  { id: 'furniture', label: 'Furniture', blurb: 'Furniture for every room',
    nameWords: ['furniture', 'chair', 'sofa', 'couch', 'table', 'desk', 'wardrobe', 'cabinet', 'bookshelf', 'mattress', 'bed frame'],
    categoryWords: ['furniture', 'sofa', 'chair', 'table', 'bedroom', 'living room'] },
  { id: 'groceries-fresh-food', label: 'Groceries and Fresh Food', blurb: 'Fresh produce, meat, dairy and pantry staples',
    nameWords: ['fruit', 'banana', 'mango', 'orange', 'apple', 'pineapple', 'avocado', 'watermelon', 'melon', 'pawpaw', 'papaya', 'passion', 'lemon', 'lime', 'grape', 'guava', 'berry', 'strawberr', 'coconut', 'ndizi', 'embe', 'chungwa', 'nanasi', 'parachichi', 'tikiti', 'nazi', 'vegetable', 'tomato', 'onion', 'potato', 'kale', 'sukuma', 'spinach', 'cabbage', 'carrot', 'pepper', 'capsicum', 'garlic', 'ginger', 'cucumber', 'lettuce', 'broccoli', 'eggplant', 'brinjal', 'okra', 'pumpkin', 'dhania', 'coriander', 'managu', 'terere', 'nyanya', 'kitunguu', 'vitunguu', 'kiazi', 'viazi', 'karoti', 'pilipili', 'kabichi', 'mboga', 'milk', 'yoghurt', 'yogurt', 'mala', 'cheese', 'butter', 'ghee', 'cream', 'egg', 'bread', 'loaf', 'chapati', 'mandazi', 'cake', 'bun', 'scone', 'maziwa', 'mayai', 'yai', 'mkate', 'meat', 'beef', 'goat', 'mutton', 'lamb', 'pork', 'chicken', 'sausage', 'fish', 'tilapia', 'omena', 'dagaa', 'prawn', 'octopus', 'tuna', 'nyama', 'kuku', 'samaki', 'mbuzi', 'rice', 'flour', 'unga', 'maize', 'sugar', 'salt', 'oil', 'beans', 'lentil', 'ndengu', 'pasta', 'spaghetti', 'noodle', 'cereal', 'oats', 'spice', 'sauce', 'honey', 'jam', 'mchele', 'sukari', 'chumvi', 'mafuta', 'maharagwe', 'juice', 'soda', 'water', 'tea', 'coffee', 'drink', 'cola', 'fanta', 'sprite', 'chai', 'kahawa', 'maji', 'smoothie'],
    categoryWords: ['food', 'grocer', 'fruit', 'matunda', 'vegetable', 'veg', 'greens', 'produce', 'mboga', 'dairy', 'bakery', 'bread', 'eggs', 'meat', 'butcher', 'fish', 'seafood', 'poultry', 'grain', 'cereal', 'staple', 'pantry', 'cooking', 'chakula', 'drink', 'beverage', 'vinywaji'] },
  { id: 'health-beauty', label: 'Health and Beauty', blurb: 'Personal care, beauty and wellness',
    nameWords: ['soap', 'detergent', 'bleach', 'tissue', 'toilet', 'sponge', 'toothpaste', 'toothbrush', 'lotion', 'shampoo', 'deodorant', 'perfume', 'makeup', 'cosmetic', 'skincare', 'vitamin', 'medicine', 'wellness', 'sabuni', 'omo', 'jik'],
    categoryWords: ['health', 'beauty', 'cosmetic', 'personal care', 'toiletr', 'hygiene', 'salon', 'wellness', 'pharmacy'] },
  { id: 'baby-kids', label: 'Baby and Kids', blurb: 'Everyday essentials for little ones',
    nameWords: ['baby', 'babies', 'diaper', 'nappy', 'stroller', 'pram', 'pacifier', 'bottle', 'onesie', 'toddler'],
    categoryWords: ['baby', 'kids', 'children', 'child', 'infant', 'nappy'] },
  { id: 'toys-games', label: 'Toys and Games', blurb: 'Toys, puzzles and games for everyone',
    nameWords: ['toy', 'game', 'puzzle', 'doll', 'lego', 'blocks', 'boardgame', 'board game', 'teddy', 'playset'],
    categoryWords: ['toy', 'game', 'puzzle', 'play'] },
  { id: 'sports-outdoors', label: 'Sports and Outdoors', blurb: 'Sports, fitness and outdoor gear',
    nameWords: ['sport', 'football', 'soccer', 'basketball', 'tennis', 'bicycle', 'bike', 'hiking', 'camping', 'backpack', 'fitness', 'gym', 'yoga', 'treadmill'],
    categoryWords: ['sport', 'outdoor', 'fitness', 'camping', 'exercise'] },
  { id: 'automotive', label: 'Automotive', blurb: 'Car accessories and care',
    nameWords: ['car', 'automotive', 'motorcycle', 'motorbike', 'tyre', 'tire', 'engine', 'windscreen', 'wiper', 'vehicle'],
    categoryWords: ['automotive', 'auto', 'car', 'vehicle', 'motorcycle'] },
  { id: 'books', label: 'Books', blurb: 'Books for learning and leisure',
    nameWords: ['book', 'novel', 'textbook', 'storybook', 'journal', 'magazine'],
    categoryWords: ['book', 'literature', 'reading', 'magazine'] },
  { id: 'music', label: 'Music', blurb: 'Instruments and music accessories',
    nameWords: ['music', 'guitar', 'piano', 'keyboard', 'instrument', 'microphone', 'headphones'],
    categoryWords: ['music', 'instrument', 'audio'] },
  { id: 'movies', label: 'Movies', blurb: 'Movies and home entertainment',
    nameWords: ['movie', 'film', 'cinema', 'dvd', 'blu-ray'],
    categoryWords: ['movie', 'film', 'cinema', 'dvd'] },
  { id: 'tools-garden', label: 'Tools and Garden', blurb: 'Tools, plants and garden supplies',
    nameWords: ['tool', 'drill', 'hammer', 'screwdriver', 'wrench', 'garden', 'plant', 'pruning', 'shears', 'watering', 'spade', 'shovel'],
    categoryWords: ['tool', 'hardware', 'garden', 'gardening', 'plant'] },
  { id: 'office-supplies', label: 'Office Supplies', blurb: 'Stationery and desk essentials',
    nameWords: ['office', 'stationery', 'notebook', 'pen', 'pencil', 'stapler', 'folder', 'paper', 'envelope', 'calculator'],
    categoryWords: ['office', 'stationery', 'school supply', 'supplies'] },
  { id: 'pet-supplies', label: 'Pet Supplies', blurb: 'Food, toys and care for pets',
    nameWords: ['pet', 'dog', 'cat food', 'cat litter', 'leash', 'collar', 'pet food', 'chew toy', 'grooming brush'],
    categoryWords: ['pet', 'pets', 'animal', 'dog', 'cat'] },
  { id: 'services', label: 'Services', blurb: 'Services from trusted local businesses',
    nameWords: ['service', 'salon', 'haircut', 'repair', 'cleaning service', 'delivery service'],
    categoryWords: ['service', 'services', 'salon', 'repair'] },
  { id: 'digital-goods', label: 'Digital Goods', blurb: 'Digital products and downloads',
    nameWords: ['digital', 'download', 'ebook', 'software', 'app', 'subscription', 'online course'],
    categoryWords: ['digital', 'download', 'software', 'ebook', 'subscription'] },
  { id: 'gift-cards', label: 'Gift Cards', blurb: 'Gift cards for any occasion',
    nameWords: ['gift card', 'voucher', 'gift voucher'],
    categoryWords: ['gift card', 'voucher', 'gift voucher'] },
  { id: 'other', label: 'More', blurb: 'Everything else from local shops', nameWords: [], categoryWords: [] },
];

export const DEPARTMENT_IDS = DEPARTMENTS.map(d => d.id);

export type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'name';
export const SORT_LABELS: Record<SortKey, string> = {
  popular: 'Recommended', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', name: 'Name A–Z',
};

function words(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}

function hits(text: string, keys: string[]) {
  const ws = words(text);
  const flat = ws.join(' ');
  return keys.some(k => (k.includes(' ') ? flat.includes(k) : ws.some(w => k === 'car' ? w === 'car' || w === 'cars' : w.startsWith(k))));
}

export function departmentOf(product: Pick<ShopProduct, 'name' | 'category'>): DepartmentId {
  for (const d of DEPARTMENTS) if (hits(product.name, d.nameWords)) return d.id;
  for (const d of DEPARTMENTS) if (hits(product.category ?? '', d.categoryWords)) return d.id;
  return 'other';
}

export function departmentCounts(products: Pick<ShopProduct, 'name' | 'category'>[]) {
  const counts = Object.fromEntries(DEPARTMENT_IDS.map(id => [id, 0])) as Record<DepartmentId, number>;
  for (const p of products) counts[departmentOf(p)] += 1;
  return counts;
}

export type BrowseOptions = { department: DepartmentId | 'all'; query: string; sort: SortKey; inStockOnly: boolean };

export function browse<T extends ShopProduct>(products: T[], opts: BrowseOptions): T[] {
  const terms = words(opts.query);
  const list = products.filter(p => {
    if (opts.department !== 'all' && departmentOf(p) !== opts.department) return false;
    if (opts.inStockOnly && p.stock <= 0) return false;
    if (terms.length) {
      const label = DEPARTMENTS.find(d => d.id === departmentOf(p))?.label ?? '';
      const hay = words(`${p.name} ${p.category} ${p.merchantName} ${label}`);
      // Every typed word must appear; local names ("nyanya") also match their English word.
      const found = (t: string) => hay.some(w => w.startsWith(t));
      if (!terms.every(t => found(t) || (!!SYNONYMS[t] && found(SYNONYMS[t]!)))) return false;
    }
    return true;
  });
  const sorted = [...list];
  if (opts.sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (opts.sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (opts.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)); // stable: keeps newest-first within groups
  return sorted;
}
