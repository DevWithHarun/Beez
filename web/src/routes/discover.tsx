import { createFileRoute } from "@tanstack/react-router";
import MobileTabBar from "@/components/beez/MobileTabBar";
import DiscoverPage from "@/features/discover/DiscoverPage";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover local shops | Beez" },
      {
        name: "description",
        content: "Browse local shops and products on Beez. No account needed.",
      },
    ],
  }),
  component: DiscoverRoute,
});

function DiscoverRoute() {
  return (
    <>
      <DiscoverPage />
      <MobileTabBar />
    </>
  );
}
