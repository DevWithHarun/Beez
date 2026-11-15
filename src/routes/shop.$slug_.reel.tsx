import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ReelFeed } from '@/components/reel/ReelFeed';
import { ShopState } from '@/components/reel/ShopState';
import { shopQuery } from '@/lib/shop-queries';

export const Route = createFileRoute('/shop/$slug_/reel')({
  head: () => ({
    meta: [
      { title: 'Shop reel – swipe their products | Beez' },
      { name: 'description', content: "Watch the shop's intro and swipe through its products, adding to your cart in one tap." },
      { property: 'og:title', content: 'Shop reel on Beez' },
      { property: 'og:description', content: "Swipe through one shop's products and add to cart in one tap." },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ShopReelPage,
});

function ShopReelPage() {
  const { slug } = Route.useParams();
  const shop = useQuery(shopQuery(slug));
  if (shop.isPending) return <ShopState kind="loading" dark />;
  if (shop.isError) return <ShopState kind="error" dark onRetry={() => void shop.refetch()} />;
  if (!shop.data) return <ShopState kind="missing" dark />;
  return <ReelFeed key={shop.data.id} mode={{ kind: 'shop', shop: shop.data }} />;
}
