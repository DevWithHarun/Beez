import { createFileRoute, redirect } from '@tanstack/react-router';

// The reel moved to /reel; keep old links working.
export const Route = createFileRoute('/reels')({
  beforeLoad: () => {
    throw redirect({ to: '/reel', replace: true });
  },
});
