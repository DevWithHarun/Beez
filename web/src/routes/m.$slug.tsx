import { createFileRoute } from "@tanstack/react-router";
import ShopPage from "@/features/discover/ShopPage";

export const Route = createFileRoute("/m/$slug")({
  head: () => ({ meta: [{ title: "Shop | Beez" }] }),
  component: ShopRoute,
});

function ShopRoute() {
  const { slug } = Route.useParams();
  return <ShopPage slug={slug} />;
}
