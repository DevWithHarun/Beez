import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/features/admin/AdminDashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console · Beez" },
      { name: "description", content: "Operations dashboard for Beez admins." },
    ],
  }),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  return <AdminDashboard />;
}
