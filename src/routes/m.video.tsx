import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MerchantVideoStudio, type StudioTarget } from '@/components/merchant-video/MerchantVideoStudio';
import { ShopState } from '@/components/reel/ShopState';
import { requireWorkspace } from '@/lib/workspace-guard';
import { loadMyShop } from '@/lib/merchant-video-api';
import { supabase } from '@/integrations/supabase/client';

type VideoSearch = { start?: 'record' | 'upload'; product?: string; new?: '1' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute('/m/video')({
  ssr: false,
  // Only signed-in merchants get in: others go to sign-in or business setup.
  beforeLoad: () => requireWorkspace('merchant'),
  validateSearch: (search: Record<string, unknown>): VideoSearch => ({
    ...(search['start'] === 'record' || search['start'] === 'upload' ? { start: search['start'] } : {}),
    ...(typeof search['product'] === 'string' && UUID.test(search['product']) ? { product: search['product'] } : {}),
    ...(search['new'] === '1' || search['new'] === 1 ? { new: '1' as const } : {}),
  }),
  pendingComponent: () => <ShopState kind="loading" dark />,
  head: () => ({
    meta: [
      { title: 'Record a shop or product video | Beez' },
      { name: 'description', content: 'Record your shop intro or a short product video for the Beez reel.' },
      { property: 'og:title', content: 'Record a shop or product video | Beez' },
      { property: 'og:description', content: 'Show your shop and products in short videos.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: VideoPage,
});

async function loadTarget(merchantId: string, search: VideoSearch): Promise<StudioTarget | null> {
  if (search.new) return { kind: 'new-product' };
  if (!search.product) return { kind: 'intro' };
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price_kes, unit')
    .eq('id', search.product)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error('This product could not be loaded. Please try again.');
  return data ? { kind: 'product', product: data } : null;
}

function VideoPage() {
  const search = Route.useSearch();
  const shop = useQuery({ queryKey: ['my-shop-video'], queryFn: loadMyShop, staleTime: 0 });
  const target = useQuery({
    queryKey: ['video-target', shop.data?.id, search.product ?? null, search.new ?? null],
    queryFn: () => loadTarget(shop.data!.id, search),
    enabled: !!shop.data,
  });
  if (shop.isPending || (shop.data && target.isPending)) return <ShopState kind="loading" dark />;
  if (shop.isError || target.isError) return <ShopState kind="error" dark onRetry={() => { void shop.refetch(); void target.refetch(); }} />;
  if (!shop.data || !target.data) return <ShopState kind="missing" dark />;
  return (
    <MerchantVideoStudio
      key={`${target.data.kind}-${search.product ?? ''}`}
      shop={{ id: shop.data.id, name: shop.data.name, slug: shop.data.slug ?? null, category: shop.data.category ?? null }}
      start={search.start}
      target={target.data}
    />
  );
}
