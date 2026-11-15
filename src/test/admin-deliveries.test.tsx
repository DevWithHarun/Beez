import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const adminData = vi.hoisted(() => ({
  useTable: vi.fn(),
  exportCsv: vi.fn(),
  updateAdminOrderStatus: vi.fn(),
  reloadOrders: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  useTable: adminData.useTable,
  exportCsv: adminData.exportCsv,
  updateAdminOrderStatus: adminData.updateAdminOrderStatus,
  ORDER_STATUSES: [
    "Pending",
    "Preparing",
    "Ready for Pickup",
    "Assigned",
    "In Transit",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  ADMIN_EDITABLE_ORDER_STATUSES: [
    "Pending",
    "Preparing",
    "Ready for Pickup",
    "Assigned",
    "In Transit",
    "Out for Delivery",
  ],
  kes: (value: number) => `KES ${value}`,
  pillClass: () => "prep",
  timeAgo: () => "recently",
}));

vi.mock("@/components/admin/AdminShell", () => ({
  PageTitle: ({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{sub}</p>
      {action}
    </header>
  ),
}));

import { DeliveriesPage } from "@/components/admin/DeliveriesPage";

const riders = [
  { id: "rider-1", full_name: "Amina Rider" },
  { id: "rider-2", full_name: "Ben Rider" },
];

const orders = [
  {
    id: "BEE200001",
    merchant_name: "Coast Market",
    pickup_area: "Mombasa",
    customer_area: "Nyali",
    customer_name: "Jane Doe",
    customer_phone: "+254700111111",
    total_kes: 1250,
    status: "In Transit",
    rider_id: "rider-1",
    created_at: "2026-10-20T08:00:00Z",
    updated_at: "2026-10-22T08:00:00Z",
  },
  {
    id: "BEE200002",
    merchant_name: "Mama Fresh",
    pickup_area: "Likoni",
    customer_area: "Kisauni",
    customer_name: "John Smith",
    customer_phone: "+254700222222",
    total_kes: 800,
    status: "Delivered",
    rider_id: "rider-2",
    created_at: "2026-10-21T08:00:00Z",
    updated_at: "2026-10-22T09:00:00Z",
  },
];

beforeEach(() => {
  adminData.useTable.mockImplementation((table: string) => ({
    rows: table === "orders" ? orders : riders,
    loaded: true,
    error: null,
    reload: adminData.reloadOrders,
  }));
  adminData.updateAdminOrderStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Deliveries tab", () => {
  it("shows active delivery workload and hides completed trips", () => {
    render(<DeliveriesPage />);

    expect(screen.getByRole("heading", { name: "Deliveries" })).toBeInTheDocument();
    expect(screen.getByText("1 live deliveries")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
  });

  it("filters by rider and route text and exports only the visible live deliveries", () => {
    render(<DeliveriesPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search deliveries" }), {
      target: { value: "Amina" },
    });

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(adminData.exportCsv).toHaveBeenCalledWith("deliveries.csv", [
      expect.objectContaining({ id: "BEE200001", rider: "Amina Rider", status: "In Transit" }),
    ]);
  });

  it("updates a delivery status through the admin backend operation", async () => {
    render(<DeliveriesPage />);
    fireEvent.change(screen.getByLabelText("Update status for delivery BEE200001"), {
      target: { value: "Out for Delivery" },
    });

    await waitFor(() => {
      expect(adminData.updateAdminOrderStatus).toHaveBeenCalledWith(
        "BEE200001",
        "Out for Delivery",
      );
      expect(adminData.reloadOrders).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Delivery #BEE200001 moved to Out for Delivery.",
    );
  });

  it("shows backend failures without reporting a success message", async () => {
    adminData.updateAdminOrderStatus.mockRejectedValueOnce(
      new Error("Delivery status update rejected."),
    );
    render(<DeliveriesPage />);
    fireEvent.change(screen.getByLabelText("Update status for delivery BEE200001"), {
      target: { value: "Out for Delivery" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Delivery status update rejected.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
