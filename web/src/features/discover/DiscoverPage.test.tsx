import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCartProduct, readCart } from "./cart";
import { getShop, getShops, getZones } from "./api";
import DiscoverPage from "./DiscoverPage";

vi.mock("./api", () => ({
  getShop: vi.fn(),
  getShops: vi.fn(),
  getZones: vi.fn(),
}));

vi.mock("./cart", () => ({
  addCartProduct: vi.fn(),
  readCart: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { to: string; params?: { slug: string } }) => (
    <a {...props} href={params ? `/m/${params.slug}` : to}>
      {children}
    </a>
  ),
}));

const zone = { id: "zone-1", name: "Central Market" };
const shop = {
  id: "shop-1",
  slug: "mama-neema",
  name: "Mama Neema",
  category: "Groceries",
  zoneId: zone.id,
  zoneName: zone.name,
  locationText: "Westlands",
  isOpen: true,
};
const product = {
  id: "product-1",
  name: "Avocado",
  unit: "each",
  priceKes: 50,
  inStock: true,
};

function renderDiscover() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DiscoverPage />
    </QueryClientProvider>,
  );
}

async function chooseArea() {
  await screen.findByRole("option", { name: zone.name });
  const areaSelect = await screen.findByRole("combobox", { name: "Choose your area" });
  fireEvent.change(areaSelect, {
    target: { value: zone.id },
  });
  await waitFor(() => expect(areaSelect).toHaveValue(zone.id));
}

beforeEach(() => {
  vi.mocked(getZones).mockResolvedValue({ items: [zone], nextCursor: null });
  vi.mocked(getShops).mockResolvedValue({ items: [shop], nextCursor: null });
  vi.mocked(getShop).mockResolvedValue({ ...shop, products: [product] });
  vi.mocked(readCart).mockReturnValue([]);
  vi.mocked(addCartProduct).mockReturnValue("added");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DiscoverPage", () => {
  it("loads real products for the selected service area and adds them to the basket", async () => {
    renderDiscover();
    await chooseArea();

    expect(await screen.findByText("Avocado")).toBeInTheDocument();
    expect(screen.getAllByText("Mama Neema")).toHaveLength(2);
    expect(screen.getByText("50")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Avocado to basket" }));

    await waitFor(() => {
      expect(addCartProduct).toHaveBeenCalledWith({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        zoneId: zone.id,
        zoneName: zone.name,
        shopName: shop.name,
        shopSlug: shop.slug,
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent("Avocado added to your basket.");
  });

  it("prevents adding products from a closed shop", async () => {
    vi.mocked(getShops).mockResolvedValue({
      items: [{ ...shop, isOpen: false }],
      nextCursor: null,
    });
    vi.mocked(getShop).mockResolvedValue({ ...shop, isOpen: false, products: [product] });
    renderDiscover();
    await chooseArea();

    const addButton = await screen.findByRole("button", { name: "Mama Neema is closed" });

    expect(addButton).toBeDisabled();
    expect(screen.getByText("Shop closed")).toBeInTheDocument();
    expect(addCartProduct).not.toHaveBeenCalled();
  });

  it("keeps the designed welcome screen visible when the discovery API is unavailable", async () => {
    vi.mocked(getZones).mockRejectedValue(new Error("Beez is unavailable."));
    renderDiscover();

    expect(await screen.findByRole("alert")).toHaveTextContent("Beez is unavailable.");
    expect(screen.getByRole("heading", { name: "Good things, close by." })).toBeInTheDocument();
  });
});
