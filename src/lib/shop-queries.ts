import { queryOptions } from '@tanstack/react-query';
import { fetchHomeShops, fetchShop, fetchShopProducts } from '@/lib/reel-api';

export const shopQuery = (slug: string) =>
  queryOptions({ queryKey: ['shop', slug], queryFn: () => fetchShop(slug), staleTime: 60_000 });

export const shopProductsQuery = (merchantId: string | undefined) =>
  queryOptions({
    queryKey: ['shop-products', merchantId],
    queryFn: () => fetchShopProducts(merchantId!),
    enabled: !!merchantId,
    staleTime: 30_000,
  });

export const homeShopsQuery = queryOptions({ queryKey: ['home-shops'], queryFn: fetchHomeShops, staleTime: 60_000 });
