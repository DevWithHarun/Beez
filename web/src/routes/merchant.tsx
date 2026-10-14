import { createFileRoute } from "@tanstack/react-router";
import RoleWorkspace from "@/features/workspace/RoleWorkspace";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant workspace · Beez" },
      { name: "description", content: "Manage your Beez merchant account." },
    ],
  }),
  component: MerchantRoute,
});

function MerchantRoute() {
  return <RoleWorkspace role="MERCHANT" />;
}
