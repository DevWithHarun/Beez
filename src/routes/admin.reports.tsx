import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/admin/ReportsPage";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports | Beez Admin" },
      { name: "description", content: "Beez admin: reports." },
      { property: "og:title", content: "Reports | Beez Admin" },
      { property: "og:description", content: "Manage Beez reports." },
    ],
  }),
  component: ReportsPage,
});
