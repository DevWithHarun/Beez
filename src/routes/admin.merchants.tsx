import { createFileRoute } from '@tanstack/react-router';
import { MerchantsPage } from '@/components/admin/MerchantsPage';

export const Route = createFileRoute('/admin/merchants')({
  head: () => ({ meta: [{ title: 'Merchants | Beez Admin' }, { name: 'description', content: 'Beez admin: merchants.' }, { property: 'og:title', content: 'Merchants | Beez Admin' }, { property: 'og:description', content: 'Manage Beez merchants.' }] }),
  component: MerchantsPage,
});
