import { useEffect, useState } from 'react';

const KEY = 'beez-favourites';

// Saved (hearted) products, kept on this device.
export function useFavourites() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(saved)) setIds(saved.filter((x): x is string => typeof x === 'string'));
    } catch { /* ignore broken storage */ }
  }, []);
  const toggle = (id: string) => setIds(current => {
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
