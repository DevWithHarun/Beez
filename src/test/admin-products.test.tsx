import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const adminData = vi.hoisted(() => ({
  useTable: vi.fn(),
  exportCsv: vi.fn(),
  saveAdminProduct: vi.fn(),
  updateAdminProduct: vi.fn(),
  deleteAdminProduct: vi.fn(),
  reloadProducts: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  useTable: adminData.useTable,
  exportCsv: adminData.exportCsv,
  saveAdminProduct: adminData.saveAdminProduct,
  updateAdminProduct: adminData.updateAdminProduct,
  deleteAdminProduct: adminData.deleteAdminProduct,
  kes: (value: number) => `KES ${value}`,
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

import { ProductsPage } from "@/components/admin/ProductsPage";

const products = [
  {
    id: "product-active",
    merchant_id: "merchant-one",
    name: "Mangoes",
    category: "Fruit",
    price_kes: 150,
    stock: 3,
    active: true,
    created_at: "2026-10-20T10:00:00Z",
  },
  {
    id: "product-inactive",
    merchant_id: null,
    name: "Tea",
    category: "Drinks",
    price_kes: 250,
    stock: 0,
    active: false,
    created_at: "2026-10-19T10:00:00Z",
  },
];

const merchants = [
  {
    id: "merchant-one",
    name: "Coast Market",
    area: "Mombasa",
    phone: "+254700000001",
    category: "Grocery",
    business_type: "Shop",
    owner_id: null,
    active: true,
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
  },
];

beforeEach(() => {
  adminData.useTable.mockImplementation((table: string) => ({
    rows: table === "products" ? products : merchants,
    loaded: true,
    error: null,
    reload: adminData.reloadProducts,
  }));
  adminData.saveAdminProduct.mockResolvedValue(undefined);
  adminData.updateAdminProduct.mockResolvedValue(undefined);
  adminData.deleteAdminProduct.mockResolvedValue(undefined);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Admin Products tab", () => {
  it("renders the live catalog with availability and stock summaries", () => {
    render(<ProductsPage />);

    expect(screen.getByText("2 products · 1 active · 1 out of stock")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Mangoes/ })).getByText("Coast Market"),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Mangoes/ })).toHaveTextContent("Available");
    expect(screen.getByRole("row", { name: /Tea/ })).toHaveTextContent("Unavailable");
  });

  it("searches and filters products, then exports only the visible records", () => {
    render(<ProductsPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search products" }), {
      target: { value: "Mango" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by availability" }), {
      target: { value: "active" },
    });

    expect(screen.getByText("Mangoes")).toBeInTheDocument();
    expect(screen.queryByText("Tea")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(adminData.exportCsv).toHaveBeenCalledWith("products.csv", [
      expect.objectContaining({ name: "Mangoes", merchant: "Coast Market", stock: 3 }),
    ]);
  });

  it("adds a product with validated numeric values and reloads the live catalog", async () => {
    render(<ProductsPage />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Oranges" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Fruit" } });
    fireEvent.change(screen.getByLabelText("Price (KES)"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "12" } });
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "merchant-one" } });
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));

    await waitFor(() => {
      expect(adminData.saveAdminProduct).toHaveBeenCalledWith(null, {
        name: "Oranges",
        category: "Fruit",
        price_kes: 80,
        stock: 12,
        merchant_id: "merchant-one",
        active: true,
      });
      expect(adminData.reloadProducts).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Product added.");
  });

  it("edits product data and saves inventory and availability changes through the backend", async () => {
    render(<ProductsPage />);
    const mangoRow = screen.getByRole("row", { name: /Mangoes/ });
    fireEvent.click(within(mangoRow).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Price (KES)"), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(adminData.saveAdminProduct).toHaveBeenCalledWith(
        "product-active",
        expect.objectContaining({
          price_kes: 175,
          stock: 3,
          active: true,
        }),
      );
    });

    fireEvent.click(within(mangoRow).getByRole("button", { name: "Increase stock for Mangoes" }));
    await waitFor(() =>
      expect(adminData.updateAdminProduct).toHaveBeenCalledWith("product-active", { stock: 4 }),
    );

    fireEvent.click(within(mangoRow).getByRole("button", { name: "Make unavailable" }));
    await waitFor(() =>
      expect(adminData.updateAdminProduct).toHaveBeenCalledWith("product-active", {
        active: false,
      }),
    );
  });

  it("preserves order history when confirming a product deletion", async () => {
    render(<ProductsPage />);
    fireEvent.click(
      within(screen.getByRole("row", { name: /Mangoes/ })).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Delete Mangoes? Order history will be kept.");
      expect(adminData.deleteAdminProduct).toHaveBeenCalledWith("product-active");
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Mangoes deleted.");
  });

  it("shows backend failures without presenting a success message", async () => {
    adminData.updateAdminProduct.mockRejectedValueOnce(new Error("Stock update rejected."));
    render(<ProductsPage />);
    fireEvent.click(
      within(screen.getByRole("row", { name: /Mangoes/ })).getByRole("button", {
        name: "Increase stock for Mangoes",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Stock update rejected.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
