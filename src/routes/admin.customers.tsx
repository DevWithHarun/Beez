import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/components/admin/CustomersPage';

export const Route = createFileRoute('/admin/customers')({
  head: () => ({ meta: [{ title: 'Customers | Beez Admin' }, { name: 'description', content: 'Beez admin: customers.' }, { property: 'og:title', content: 'Customers | Beez Admin' }, { property: 'og:description', content: 'Manage Beez customers.' }] }),
  component: CustomersPage,
});
