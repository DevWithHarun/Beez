import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const adminData = vi.hoisted(() => ({
  useTable: vi.fn(),
  exportCsv: vi.fn(),
  reloadOrders: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  useTable: adminData.useTable,
  exportCsv: adminData.exportCsv,
  inLastDays: <T extends { created_at: string }>(rows: T[], days: number) => {
    const start = Date.now() - days * 86400000;
    return rows.filter((row) => new Date(row.created_at).getTime() > start);
  },
  kes: (value: number) => `KES ${Math.round(value)}`,
  statusCounts: (orders: { status: string }[]) => ({
    Delivered: orders.filter((order) => order.status === "Delivered").length,
    "In Transit": orders.filter((order) => order.status === "In Transit").length,
    Pending: orders.filter(
      (order) =>
        !["Delivered", "In Transit", "Out for Delivery", "Cancelled"].includes(order.status),
    ).length,
    Cancelled: orders.filter((order) => order.status === "Cancelled").length,
  }),
}));

vi.mock("@/components/admin/AdminShell", () => ({
  PageTitle: ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{sub}</p>
      {action}
    </header>
  ),
}));

import { ReportsPage } from "@/components/admin/ReportsPage";

const now = Date.now();
const rows = [
  {
    id: "BEE1001",
    created_at: new Date(now - 86400000).toISOString(),
    merchant_name: "Coast Market",
    status: "Delivered",
    payment_status: "Paid",
    payment_method: "M-Pesa",
    total_kes: 1250,
    delivery_fee_kes: 150,
    service_fee_kes: 60,
  },
  {
    id: "BEE1002",
    created_at: new Date(now - 2 * 86400000).toISOString(),
    merchant_name: "Coast Market",
    status: "Out for Delivery",
    payment_status: "Pending",
    payment_method: "Cash on Delivery",
    total_kes: 800,
    delivery_fee_kes: 100,
    service_fee_kes: 40,
  },
  {
    id: "BEE1003",
    created_at: new Date(now - 3 * 86400000).toISOString(),
    merchant_name: "Night Market",
    status: "Cancelled",
    payment_status: "Paid",
    payment_method: "Bank Transfer",
    total_kes: 950,
    delivery_fee_kes: 120,
    service_fee_kes: 45,
  },
  {
    id: "BEE1004",
    created_at: new Date(now - 4 * 86400000).toISOString(),
    merchant_name: "Harbor Shop",
    status: "Delivered",
    payment_status: "Refunded",
    payment_method: "M-Pesa",
    total_kes: 2000,
    delivery_fee_kes: 150,
    service_fee_kes: 60,
  },
];

beforeEach(() => {
  adminData.useTable.mockReturnValue({
    rows,
    loaded: true,
    error: null,
    reload: adminData.reloadOrders,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Reports tab", () => {
  it("reports paid revenue and excludes cancelled orders from payment totals", () => {
    render(<ReportsPage />);

    expect(screen.getAllByText("Paid revenue")).toHaveLength(2);
    expect(screen.getAllByText("KES 1250")).toHaveLength(3);
    expect(screen.getByText("Pending payment value")).toBeInTheDocument();
    expect(screen.getByText("KES 800")).toBeInTheDocument();
    expect(screen.getByText("Coast Market")).toBeInTheDocument();
    expect(screen.queryByText("Night Market")).not.toBeInTheDocument();
  });

  it("exports order rows for the selected reporting period and refreshes", () => {
    render(<ReportsPage />);

    fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(adminData.exportCsv).toHaveBeenCalledWith(
      "beez-report-7-days.csv",
      expect.arrayContaining([
        expect.objectContaining({
          id: "BEE1001",
          payment_status: "Paid",
          order_total_kes: 1250,
        }),
      ]),
    );
    expect(adminData.reloadOrders).toHaveBeenCalledOnce();
  });

  it("shows load failures instead of rendering misleading report totals", () => {
    adminData.useTable.mockReturnValue({
      rows: [],
      loaded: true,
      error: "Permission denied",
      reload: adminData.reloadOrders,
    });

    render(<ReportsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load reports: Permission denied",
    );
    expect(screen.queryByText("Paid revenue")).not.toBeInTheDocument();
  });
});
