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
  image_origin?: string | null;
  description?: string | null;
  merchant_id?: string | null;
  merchant: { name: string } | null;
};
type MerchantRow = { id: string; name: string; category: string; area: string; image_url: string | null };
export type RiderProfile = { full_name: string; phone: string; vehicle_type: string | null; plate: string | null };

export function toShopProduct(row: ProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    price: row.price_kes,
    category: row.category,
    stock: row.stock,
    merchantName: row.merchant?.name ?? 'Local merchant',
    merchantId: row.merchant_id ?? null,
    imageUrl: row.image_url,
    imageOrigin: row.image_origin ?? null,
    description: row.description ?? null,
  };
}

// Active products, newest first, with their merchant's name.
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, merchant:merchants(name)')
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

// The rider assigned to an order, through a narrow lookup that only the order's
// shopper, shop or an admin can use, and only while the delivery is under way.
export function useOrderRider(orderId: string | null | undefined, riderId: string | null | undefined) {
  return useQuery({
    queryKey: ['order-rider', orderId, riderId],
    enabled: !!orderId && !!riderId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('order_rider_contact', { _order_id: orderId! });
      if (error) throw new Error('Rider details could not be loaded.');
      return ((data ?? [])[0] ?? null) as RiderProfile | null;
    },
    staleTime: 30_000,
  });
}

export { productCell };
