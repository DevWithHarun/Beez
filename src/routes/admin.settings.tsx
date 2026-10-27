import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/admin/SettingsPage";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Beez Admin" },
      { name: "description", content: "Beez admin: settings." },
      { property: "og:title", content: "Settings | Beez Admin" },
      { property: "og:description", content: "Manage Beez settings." },
    ],
  }),
  component: SettingsPage,
});
