import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/admin/PaymentsPage";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments | Beez Admin" },
      { name: "description", content: "Beez admin: payments." },
      { property: "og:title", content: "Payments | Beez Admin" },
      { property: "og:description", content: "Manage Beez payments." },
    ],
  }),
  component: PaymentsPage,
});
