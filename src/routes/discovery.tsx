import { createFileRoute, redirect } from "@tanstack/react-router";

// Friendly alias: /discovery opens the Discover page.
export const Route = createFileRoute("/discovery")({
  beforeLoad: () => {
    throw redirect({ to: "/discover", replace: true });
  },
});
