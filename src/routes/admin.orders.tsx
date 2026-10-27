import { createFileRoute } from '@tanstack/react-router';
import { OrdersPage } from '@/components/admin/OrdersPage';

export const Route = createFileRoute('/admin/orders')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s['q'] === 'string' && s['q'] ? { q: s['q'] } : {}),
  head: () => ({ meta: [{ title: 'Orders | Beez Admin' }, { name: 'description', content: 'Beez admin: orders.' }, { property: 'og:title', content: 'Orders | Beez Admin' }, { property: 'og:description', content: 'Manage Beez orders.' }] }),
  component: function Orders() { const q = Route.useSearch().q ?? ''; return <OrdersPage key={q} q={q} />; },
});
