import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  kes: (value: number) => `KES ${value}`,
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

import { PaymentsPage } from "@/components/admin/PaymentsPage";

const rows = [
  {
    id: "BEE300001",
    customer_name: "Jane Doe",
    customer_phone: "+254700000001",
    merchant_name: "Coast Market",
    payment_method: "M-Pesa",
    payment_status: "Paid",
    total_kes: 1250,
    delivery_fee_kes: 150,
    service_fee_kes: 60,
    status: "Delivered",
    created_at: "2026-10-20T08:00:00Z",
  },
  {
    id: "BEE300002",
    customer_name: "John Smith",
    customer_phone: "+254700000002",
    merchant_name: "Mama Fresh",
    payment_method: "Cash on Delivery",
    payment_status: "Pending",
    total_kes: 800,
    delivery_fee_kes: 100,
    service_fee_kes: 40,
    status: "Out for Delivery",
    created_at: "2026-10-21T08:00:00Z",
  },
  {
    id: "BEE300003",
    customer_name: "Guest User",
    customer_phone: "+254700000003",
    merchant_name: "Night Market",
    payment_method: "Bank Transfer",
    payment_status: "Paid",
    total_kes: 950,
    delivery_fee_kes: 120,
    service_fee_kes: 45,
    status: "Cancelled",
    created_at: "2026-10-22T08:00:00Z",
  },
];

beforeEach(() => {
  adminData.useTable.mockImplementation(() => ({
    rows,
    loaded: true,
    error: null,
    reload: adminData.reloadOrders,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Payments tab", () => {
  it("summarizes collected and pending values from live orders", () => {
    render(<PaymentsPage />);

    expect(screen.getByText("Collected")).toBeInTheDocument();
    expect(screen.getAllByText("KES 1250").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KES 800").length).toBeGreaterThan(0);
    expect(screen.getByText(/BEE300001/)).toBeInTheDocument();
    expect(screen.getByText(/Guest User/)).toBeInTheDocument();
  });

  it("filters by payment status and method, then exports the visible transactions", () => {
    render(<PaymentsPage />);
    fireEvent.change(screen.getByRole("combobox", { name: "Filter payments by status" }), {
      target: { value: "Paid" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter payments by method" }), {
      target: { value: "M-Pesa" },
    });

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(adminData.exportCsv).toHaveBeenCalledWith("payments.csv", [
      expect.objectContaining({ id: "BEE300001", customer: "Jane Doe", payment_status: "Paid" }),
    ]);
  });

  it("searches across payment details and only shows matches", () => {
    render(<PaymentsPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search payments" }), {
      target: { value: "Mama" },
    });

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });
});
