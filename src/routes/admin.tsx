import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AdminGate } from '@/components/admin/AdminShell';

export const Route = createFileRoute('/admin')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Beez Admin' },
      { name: 'description', content: 'Manage Beez orders, riders, merchants and support.' },
      { property: 'og:title', content: 'Beez Admin' },
      { property: 'og:description', content: 'Beez marketplace administration.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: () => <AdminGate><Outlet /></AdminGate>,
});
