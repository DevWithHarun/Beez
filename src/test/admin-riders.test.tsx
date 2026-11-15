import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const adminData = vi.hoisted(() => ({
  useTable: vi.fn(),
  exportCsv: vi.fn(),
  updateAdminRiderAvailability: vi.fn(),
  reloadRiders: vi.fn(),
  reloadOrders: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  useTable: adminData.useTable,
  exportCsv: adminData.exportCsv,
  updateAdminRiderAvailability: adminData.updateAdminRiderAvailability,
  kes: (value: number) => `KES ${value}`,
  timeAgo: () => "recently",
}));

vi.mock("@/components/admin/AdminShell", () => ({
  PageTitle: ({ title, sub, action }: { title: string; sub: string; action: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{sub}</p>
      {action}
    </header>
  ),
}));

import { RidersPage } from "@/components/admin/RidersPage";

const riders = [
  {
    id: "rider-active",
    full_name: "Amina Active",
    phone: "+254700000001",
    online: true,
    lat: -4.05,
    lng: 39.67,
    created_at: "2026-10-20T10:00:00Z",
  },
  {
    id: "rider-idle",
    full_name: "Ben Offline",
    phone: "+254700000002",
    online: false,
    lat: null,
    lng: null,
    created_at: "2026-10-19T10:00:00Z",
  },
];

const orders = [
  {
    id: "BEE100001",
    rider_id: "rider-active",
    status: "In Transit",
    rider_earning_kes: 120,
  },
  {
    id: "BEE100002",
    rider_id: "rider-active",
    status: "Delivered",
    rider_earning_kes: 250,
  },
];

beforeEach(() => {
  adminData.useTable.mockImplementation((table: string) => ({
    rows: table === "riders" ? riders : orders,
    loaded: true,
    error: null,
    reload: table === "riders" ? adminData.reloadRiders : adminData.reloadOrders,
  }));
  adminData.updateAdminRiderAvailability.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Riders tab", () => {
  it("shows live profile, active orders, completed deliveries, earnings, and shared location", () => {
    render(<RidersPage />);

    expect(screen.getByRole("heading", { name: "Riders" })).toBeInTheDocument();
    expect(
      screen.getByText("1 online · 1 currently on delivery · 2 registered"),
    ).toBeInTheDocument();
    expect(screen.getByText("Amina Active")).toBeInTheDocument();
    expect(screen.getByText("#BEE100001")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Amina Active/ })).getByText("1"),
    ).toBeInTheDocument();
    expect(screen.getByText("KES 250")).toBeInTheDocument();
    expect(screen.getByText("-4.0500, 39.6700")).toBeInTheDocument();
  });

  it("blocks forcing a rider with an active delivery offline", () => {
    render(<RidersPage />);

    expect(screen.getByRole("button", { name: "Set offline" })).toBeDisabled();
    expect(adminData.updateAdminRiderAvailability).not.toHaveBeenCalled();
  });

  it("sets an idle rider online through the admin backend operation and reloads the profile", async () => {
    render(<RidersPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set online" }));

    await waitFor(() => {
      expect(adminData.updateAdminRiderAvailability).toHaveBeenCalledWith("rider-idle", true);
      expect(adminData.reloadRiders).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Ben Offline is now online.");
  });

  it("shows backend availability errors without reporting success", async () => {
    adminData.updateAdminRiderAvailability.mockRejectedValueOnce(
      new Error("Rider has an active delivery and cannot be set offline"),
    );
    render(<RidersPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set online" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rider has an active delivery and cannot be set offline",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("filters riders by search and exports the filtered live rows", () => {
    render(<RidersPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search riders" }), {
      target: { value: "Amina" },
    });

    expect(screen.getByText("Amina Active")).toBeInTheDocument();
    expect(screen.queryByText("Ben Offline")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(adminData.exportCsv).toHaveBeenCalledWith("riders.csv", [
      expect.objectContaining({
        name: "Amina Active",
        active_orders: "BEE100001",
        delivered_orders: 1,
        delivered_earnings_kes: 250,
      }),
    ]);
  });
});
