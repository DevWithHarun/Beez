import { createFileRoute } from '@tanstack/react-router';
import { ReelAdminPage } from '@/components/admin/ReelAdminPage';

export const Route = createFileRoute('/admin/reel')({
  head: () => ({ meta: [{ title: 'Reel & videos | Beez Admin' }, { name: 'description', content: 'Beez admin: review shop videos and reel performance.' }, { property: 'og:title', content: 'Reel & videos | Beez Admin' }, { property: 'og:description', content: 'Review shop videos and see which products perform.' }] }),
  component: ReelAdminPage,
});
