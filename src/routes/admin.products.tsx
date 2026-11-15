import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/components/admin/ProductsPage";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Products | Beez Admin" },
      { name: "description", content: "Beez admin: products." },
      { property: "og:title", content: "Products | Beez Admin" },
      { property: "og:description", content: "Manage Beez products." },
    ],
  }),
  component: ProductsPage,
});
