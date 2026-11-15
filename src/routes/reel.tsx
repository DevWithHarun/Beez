import { createFileRoute } from '@tanstack/react-router';
import { ReelFeed } from '@/components/reel/ReelFeed';

type ReelSearch = { p?: string };

export const Route = createFileRoute('/reel')({
  validateSearch: (search: Record<string, unknown>): ReelSearch =>
    typeof search['p'] === 'string' && search['p'] ? { p: search['p'] } : {},
  head: () => ({
    meta: [
      { title: 'Product Reel – shop nearby stalls | Beez' },
      { name: 'description', content: 'Swipe through products from open shops near you and add to your cart in one tap.' },
      { property: 'og:title', content: 'Beez Product Reel' },
      { property: 'og:description', content: 'Swipe through products from nearby shops and add them to your cart in one tap.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ReelPage,
});

function ReelPage() {
  const { p } = Route.useSearch();
  return <ReelFeed key={p ?? 'feed'} mode={{ kind: 'global', focusProductId: p }} />;
}
