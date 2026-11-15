// Keeps unsent videos on this phone (IndexedDB) so a merchant can record in
// the market and upload later on better connectivity ("Uploading later").
export type SavedVideo = { blob: Blob; mimeType: string; durationSec: number; thumb: Blob | null; savedAt: string };

/** Details typed for a brand-new product, created when the clip uploads. */
export type DraftProduct = { name: string; category: string; price_kes: number; stock: number };

export type QueuedClip = SavedVideo & {
  key: string;
  kind: 'intro' | 'product' | 'new-product';
  productId?: string;
  productName?: string;
  draft?: DraftProduct;
  lastError?: string;
};

const DB = 'beez-merchant-video';
const STORE = 'pending';
const INTRO_KEY = 'intro';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const productQueueKey = (productId: string) => `product:${productId}`;
export const newProductQueueKey = () => `new:${crypto.randomUUID()}`;

/** Every video waiting on this phone, oldest first. */
export async function listQueuedClips(): Promise<QueuedClip[]> {
  try {
    if (typeof indexedDB === 'undefined') return [];
    const [keys, values] = await Promise.all([
      run<IDBValidKey[]>('readonly', s => s.getAllKeys()),
      run<(SavedVideo & Partial<QueuedClip>)[]>('readonly', s => s.getAll()),
    ]);
    return values
      .map((v, i) => {
        const key = String(keys[i]);
        const kind = v.kind ?? (key === INTRO_KEY ? 'intro' : key.startsWith('new:') ? 'new-product' : 'product');
        return { ...v, key, kind } as QueuedClip;
      })
      .filter(v => v.blob instanceof Blob)
      .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  } catch {
    return [];
  }
}

export async function saveQueuedClip(clip: QueuedClip) {
  try {
    await run('readwrite', s => s.put(clip, clip.key));
    return true;
  } catch {
    return false;
  }
}

export async function removeQueuedClip(key: string) {
  try { await run('readwrite', s => s.delete(key)); } catch { /* nothing saved */ }
}

// Shop intro (one per phone), kept for the intro recorder.
export async function saveVideoLocally(video: SavedVideo) {
  return saveQueuedClip({ ...video, key: INTRO_KEY, kind: 'intro' });
}

export async function loadSavedVideo(): Promise<SavedVideo | null> {
  return (await listQueuedClips()).find(c => c.key === INTRO_KEY) ?? null;
}

export async function clearSavedVideo() {
  await removeQueuedClip(INTRO_KEY);
}
