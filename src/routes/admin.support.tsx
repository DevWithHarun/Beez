import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/components/admin/SupportPage";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Support | Beez Admin" },
      { name: "description", content: "Beez admin: support." },
      { property: "og:title", content: "Support | Beez Admin" },
      { property: "og:description", content: "Manage Beez support." },
    ],
  }),
  component: SupportPage,
});
