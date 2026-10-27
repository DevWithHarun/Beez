import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const adminData = vi.hoisted(() => ({
  useTable: vi.fn(),
  createAdminTicket: vi.fn(),
  updateAdminTicket: vi.fn(),
  exportCsv: vi.fn(),
  reloadTickets: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  useTable: adminData.useTable,
  createAdminTicket: adminData.createAdminTicket,
  updateAdminTicket: adminData.updateAdminTicket,
  exportCsv: adminData.exportCsv,
  TICKET_PRIORITIES: ["Low", "Medium", "High"],
  TICKET_STATUSES: ["Open", "In Progress", "Resolved", "Closed"],
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

import { SupportPage } from "@/components/admin/SupportPage";

const rows = [
  {
    id: "ticket-1",
    ticket_no: 101,
    subject: "Missing grocery items",
    customer_name: "Amina Noor",
    customer_phone: "+254700000001",
    order_id: "BEE1001",
    priority: "High",
    status: "Open",
    notes: "",
    created_at: "2026-10-22T08:00:00Z",
  },
  {
    id: "ticket-2",
    ticket_no: 102,
    subject: "Delivery timing question",
    customer_name: "John Kamau",
    customer_phone: "+254700000002",
    order_id: null,
    priority: "Low",
    status: "Resolved",
    notes: "Customer informed",
    created_at: "2026-10-21T08:00:00Z",
  },
];

beforeEach(() => {
  adminData.useTable.mockReturnValue({
    rows,
    loaded: true,
    error: null,
    reload: adminData.reloadTickets,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Support tab", () => {
  it("creates a ticket with normalized optional fields and reports success", async () => {
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "  Payment question  " },
    });
    fireEvent.change(screen.getByLabelText("Customer"), {
      target: { value: "  Guest Name " },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: " +254700000003 " },
    });
    fireEvent.change(screen.getByLabelText("Order ID"), {
      target: { value: " " },
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "High" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open ticket" }));

    await waitFor(() =>
      expect(adminData.createAdminTicket).toHaveBeenCalledWith({
        subject: "Payment question",
        customer_name: "Guest Name",
        customer_phone: "+254700000003",
        order_id: null,
        priority: "High",
      }),
    );
    expect(adminData.reloadTickets).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Support ticket created.");
  });

  it("filters tickets by status, priority, and search", () => {
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("Filter tickets by status"), {
      target: { value: "Open" },
    });
    fireEvent.change(screen.getByLabelText("Filter tickets by priority"), {
      target: { value: "High" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search support tickets" }), {
      target: { value: "BEE1001" },
    });

    expect(screen.getByText("Missing grocery items")).toBeInTheDocument();
    expect(screen.queryByText("Delivery timing question")).not.toBeInTheDocument();
  });

  it("saves status and notes with explicit error feedback", async () => {
    adminData.updateAdminTicket.mockRejectedValueOnce(new Error("Permission denied"));
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("Status for ticket TKT-101"), {
      target: { value: "In Progress" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
    expect(adminData.updateAdminTicket).toHaveBeenCalledWith("ticket-1", {
      status: "In Progress",
    });

    fireEvent.change(screen.getByLabelText("Notes for ticket TKT-101"), {
      target: { value: "Contacted the customer" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save notes" })[0]!);

    await waitFor(() =>
      expect(adminData.updateAdminTicket).toHaveBeenLastCalledWith("ticket-1", {
        notes: "Contacted the customer",
      }),
    );
  });

  it("exports only the currently filtered tickets", () => {
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("Filter tickets by status"), {
      target: { value: "Open" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(adminData.exportCsv).toHaveBeenCalledWith("support-tickets.csv", [
      expect.objectContaining({
        ticket_no: "TKT-101",
        subject: "Missing grocery items",
        status: "Open",
      }),
    ]);
  });
});
