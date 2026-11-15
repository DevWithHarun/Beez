// Pure helpers for the shopper voice assistant: split a spoken shopping list
// into items, match them to the catalogue, and word the spoken reply.
// Rules first; the AI is only asked when these can't place every item.

export type ShopperLanguage = 'en' | 'sw' | 'fr';

export type CatalogEntry = { id: string; name: string; category: string; price: number; stock: number; merchantName: string };
export type SpokenItem = { quantity: number; phrase: string };
export type ListLine = { heard: string; quantity: number; productId: string | null; limited: boolean };

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, couple: 2, half: 1, dozen: 12,
  moja: 1, mmoja: 1, mbili: 2, wawili: 2, tatu: 3, watatu: 3, nne: 4, wanne: 4, tano: 5, watano: 5,
  sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10, nusu: 1,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, douzaine: 12, demi: 1,
};

// Units, measures and filler words that never name a product.
const FILLER = new Set([
  'kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes', 'g', 'gram', 'grams', 'grammes',
  'loaf', 'loaves', 'packet', 'packets', 'pack', 'packs', 'bunch', 'bunches', 'litre', 'litres', 'liter', 'liters', 'l',
  'piece', 'pieces', 'pcs', 'pc', 'bottle', 'bottles', 'tray', 'trays', 'bag', 'bags', 'box', 'boxes', 'tin', 'tins', 'cup', 'cups',
  'of', 'the', 'some', 'please', 'i', 'want', 'need', 'would', 'like', 'give', 'me', 'get', 'add', 'buy', 'order', 'to', 'my', 'cart', 'also', 'and', 'with',
  'nataka', 'naomba', 'nipe', 'niletee', 'ongeza', 'nunua', 'tafadhali', 'pia', 'ya', 'za', 'la', 'cha', 'wa', 'kipande', 'vipande', 'pakiti', 'chupa', 'mfuko',
  'je', 'veux', 'voudrais', 'de', 'du', 'des', "d'", 'le', 'les', 'et', 'sil', 'vous', 'plait', 'ajoute', 'ajouter', 'acheter', 'paquet', 'bouteille', 'litre',
]);

// Local names → the English word a merchant is likely to use in a product name.
export const SYNONYMS: Record<string, string> = {
  nyanya: 'tomato', tomate: 'tomato', mkate: 'bread', pain: 'bread', maziwa: 'milk', lait: 'milk',
  sukari: 'sugar', sucre: 'sugar', unga: 'flour', farine: 'flour', mchele: 'rice', wali: 'rice', riz: 'rice',
  ndizi: 'banana', banane: 'banana', kitunguu: 'onion', vitunguu: 'onion', oignon: 'onion',
  kiazi: 'potato', viazi: 'potato', patate: 'potato', yai: 'egg', mayai: 'egg', oeuf: 'egg', oeufs: 'egg',
  chumvi: 'salt', sel: 'salt', mafuta: 'oil', huile: 'oil', embe: 'mango', maembe: 'mango', mangue: 'mango',
  chungwa: 'orange', machungwa: 'orange', sukuma: 'kale', kabichi: 'cabbage', chou: 'cabbage',
  nyama: 'meat', viande: 'meat', kuku: 'chicken', poulet: 'chicken', samaki: 'fish', poisson: 'fish',
  maji: 'water', eau: 'water', chai: 'tea', the: 'tea', kahawa: 'coffee', cafe: 'coffee',
  parachichi: 'avocado', avocat: 'avocado', karoti: 'carrot', carotte: 'carrot', pilipili: 'pepper', poivron: 'pepper',
  maharagwe: 'bean', haricot: 'bean', tikiti: 'watermelon', nanasi: 'pineapple', ananas: 'pineapple',
  tomatoes: 'tomato', potatoes: 'potato', mangoes: 'mango',
};

const QUESTION = /\?|^(what|which|do you|have you|is there|are there|how much|where|show me|find|search|recommend|nini|je kuna|kuna|ni bei gani|bei|qu'est|quel|quelle|avez|est-ce|montre|cherche)\b/i;

export function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9'\s.,&+-]/g, ' ');
}

function stem(word: string) {
  const w = SYNONYMS[word] ?? word;
  if (SYNONYMS[w]) return SYNONYMS[w]!;
  if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return SYNONYMS[w.slice(0, -1)] ?? w.slice(0, -1);
  return w;
}

export function looksLikeQuestion(text: string) {
  return QUESTION.test(text.trim());
}

/** Split "2 kg tomatoes and a loaf of bread" into [{2, tomatoes}, {1, bread}]. */
export function parseSpokenList(text: string): SpokenItem[] {
  const parts = normalize(text).split(/,|;|\band\b|\bna\b|\bet\b|\bplus\b|\bwith\b|&|\+|\.(?!\d)/);
  const items: SpokenItem[] = [];
  for (const part of parts) {
    const words = part.replace(/(\d)\s*(kg|g|l)\b/g, '$1 $2').split(/\s+/).filter(Boolean);
    let quantity: number | null = null;
    const rest: string[] = [];
    for (const w of words) {
      const digits = /^\d+(?:\.\d+)?$/.test(w) ? Math.ceil(Number(w)) : null;
      if (quantity === null && digits !== null && digits > 0) { quantity = digits; continue; }
      if (quantity === null && NUMBER_WORDS[w] !== undefined) { quantity = NUMBER_WORDS[w]!; continue; }
      if (FILLER.has(w) || NUMBER_WORDS[w] !== undefined) continue;
      rest.push(w);
    }
    const phrase = rest.join(' ').trim();
    if (phrase.length >= 2) items.push({ quantity: Math.min(quantity ?? 1, 99), phrase });
  }
  return items;
}

/** The best in-stock product for a spoken phrase, or null. */
export function matchProduct(phrase: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const wanted = normalize(phrase).split(/\s+/).filter(w => w.length >= 3).map(stem);
  if (!wanted.length) return null;
  let best: { entry: CatalogEntry; score: number } | null = null;
  for (const entry of catalog) {
    const tokens = normalize(entry.name).split(/\s+/).filter(w => w.length >= 3).map(stem);
    const score = wanted.filter(w => tokens.includes(w)).length;
    if (!score) continue;
    const better = !best
      || score > best.score
      || (score === best.score && (entry.stock > 0 ? 1 : 0) > (best.entry.stock > 0 ? 1 : 0))
      || (score === best.score && (entry.stock > 0) === (best.entry.stock > 0) && entry.stock > best.entry.stock);
    if (better) best = { entry, score };
  }
  return best?.entry ?? null;
}

/** Turn spoken items into cart lines, keeping quantities within stock. */
export function toListLines(items: SpokenItem[], catalog: CatalogEntry[]): ListLine[] {
  return items.map(item => {
    const product = matchProduct(item.phrase, catalog);
    if (!product || product.stock <= 0) return { heard: item.phrase, quantity: item.quantity, productId: null, limited: false };
    const quantity = Math.min(item.quantity, product.stock);
    return { heard: item.phrase, quantity, productId: product.id, limited: quantity < item.quantity };
  });
}

export function linesNeedAi(text: string, lines: ListLine[]) {
  return looksLikeQuestion(text) || lines.length === 0 || lines.some(l => !l.productId);
}

const T = {
  en: { found: 'I found', missing: (n: string) => `${n} isn't available right now.`, limited: (n: string, q: number) => `Only ${q} ${n} left, so I added ${q}.`, tap: 'Tap Add to cart when you are ready.', nothing: "Sorry, I couldn't find that. Try saying something like: 2 kg tomatoes and a loaf of bread." },
  sw: { found: 'Nimepata', missing: (n: string) => `${n} haipatikani kwa sasa.`, limited: (n: string, q: number) => `${n} zimebaki ${q} tu, nimeweka ${q}.`, tap: 'Bonyeza Weka kwenye kikapu ukiwa tayari.', nothing: 'Samahani, sikupata hiyo. Jaribu kusema: nyanya kilo mbili na mkate mmoja.' },
  fr: { found: "J'ai trouvé", missing: (n: string) => `${n} n'est pas disponible pour le moment.`, limited: (n: string, q: number) => `Il ne reste que ${q} ${n}, j'en ai ajouté ${q}.`, tap: 'Touchez Ajouter au panier quand vous êtes prêt.', nothing: "Désolé, je n'ai pas trouvé. Essayez : 2 kg de tomates et un pain." },
} as const;

export function composeReply(lines: ListLine[], catalog: CatalogEntry[], lang: ShopperLanguage) {
  const t = T[lang];
  const found = lines.filter(l => l.productId);
  if (!found.length) return lines.length ? lines.map(l => t.missing(l.heard)).join(' ') : t.nothing;
  const names = found.map(l => `${l.quantity} ${catalog.find(c => c.id === l.productId)?.name ?? l.heard}`);
  const parts = [`${t.found} ${names.join(', ')}.`];
  for (const l of found.filter(l => l.limited)) parts.push(t.limited(catalog.find(c => c.id === l.productId)?.name ?? l.heard, l.quantity));
  for (const l of lines.filter(l => !l.productId)) parts.push(t.missing(l.heard));
  parts.push(t.tap);
  return parts.join(' ');
}

/** Merge new lines into an existing list: same product adds up, capped at stock. */
export function mergeLines(current: ListLine[], incoming: ListLine[], catalog: CatalogEntry[]): ListLine[] {
  const next = current.map(l => ({ ...l }));
  for (const line of incoming) {
    const same = line.productId ? next.find(l => l.productId === line.productId) : next.find(l => !l.productId && l.heard === line.heard);
    if (!same) { next.push({ ...line }); continue; }
    const stock = catalog.find(c => c.id === line.productId)?.stock ?? 99;
    same.quantity = Math.min(same.quantity + line.quantity, stock, 99);
  }
  return next;
}
