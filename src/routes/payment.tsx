import { createFileRoute, redirect } from '@tanstack/react-router';

// Payment is now part of the single checkout page; old links land there.
export const Route = createFileRoute('/payment')({
  beforeLoad: () => {
    throw redirect({ to: '/checkout', replace: true });
  },
});
