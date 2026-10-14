import { createFileRoute } from "@tanstack/react-router";
import RoleWorkspace from "@/features/workspace/RoleWorkspace";

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "Rider workspace · Beez" },
      { name: "description", content: "Manage your Beez rider account." },
    ],
  }),
  component: RiderRoute,
});

function RiderRoute() {
  return <RoleWorkspace role="RIDER" />;
}
