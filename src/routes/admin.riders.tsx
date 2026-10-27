import { createFileRoute } from '@tanstack/react-router';
import { RidersPage } from '@/components/admin/RidersPage';

export const Route = createFileRoute('/admin/riders')({
  head: () => ({ meta: [{ title: 'Riders | Beez Admin' }, { name: 'description', content: 'Beez admin: riders.' }, { property: 'og:title', content: 'Riders | Beez Admin' }, { property: 'og:description', content: 'Manage Beez riders.' }] }),
  component: RidersPage,
});
