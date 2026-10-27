import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { productCell, type ShopProduct } from '@/lib/marketplace';

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price_kes: number;
  stock: number;
  image_url: string | null;
  merchant: { name: string } | null;
};
type MerchantRow = { id: string; name: string; category: string; area: string; image_url: string | null };
export type RiderProfile = { id: string; full_name: string; phone: string; online: boolean };

export function toShopProduct(row: ProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    price: row.price_kes,
    category: row.category,
    stock: row.stock,
    merchantName: row.merchant?.name ?? 'Local merchant',
    imageUrl: row.image_url,
  };
}

// Active products, newest first, with their merchant's name.
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, price_kes, stock, image_url, merchant:merchants(name)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw new Error('Products could not be loaded right now. Please try again.');
      return (data as ProductRow[]).map(toShopProduct);
    },
    staleTime: 60_000,
  });
}

// Active merchants for the Discover page.
export function useShopMerchants() {
  return useQuery({
    queryKey: ['shop-merchants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, category, area, image_url')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw new Error('Merchants could not be loaded right now. Please try again.');
      return data as MerchantRow[];
    },
    staleTime: 60_000,
  });
}

// The rider assigned to an order. Customers may read the rider of their own order.
export function useOrderRider(riderId: string | null | undefined) {
  return useQuery({
    queryKey: ['order-rider', riderId],
    enabled: !!riderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riders')
        .select('id, full_name, phone, online')
        .eq('id', riderId!)
        .maybeSingle();
      if (error) throw new Error('Rider details could not be loaded.');
      return (data ?? null) as RiderProfile | null;
    },
    staleTime: 30_000,
  });
}

export { productCell };
