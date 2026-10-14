import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getZones } from "@/features/discover/api";
import MerchantWorkspace from "./MerchantWorkspace";
import {
  archiveMerchantProduct,
  getMerchantProducts,
  getMerchantShop,
  saveMerchantAvailability,
  saveMerchantShop,
  updateMerchantProduct,
} from "./api";

vi.mock("@/features/discover/api", () => ({
  getZones: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("./api", () => ({
  archiveMerchantProduct: vi.fn(),
  createMerchantProduct: vi.fn(),
  getMerchantProducts: vi.fn(),
  getMerchantShop: vi.fn(),
  saveMerchantAvailability: vi.fn(),
  saveMerchantShop: vi.fn(),
  updateMerchantProduct: vi.fn(),
}));

const shop = {
  id: "shop-1",
  slug: "mama-neema",
  businessName: "Mama Neema",
  category: "Groceries",
  zoneId: "zone-1",
  zoneName: "Nairobi",
  locationText: "Westlands",
  status: "ACTIVE",
  isOpen: false,
  openingHours: {},
  lat: -1.2675,
  lng: 36.8108,
  payoutPhone: "+254712345678",
};

const product = {
  id: "product-1",
  name: "Avocado",
  unit: "each",
  priceKes: 50,
  inStock: true,
};

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MerchantWorkspace initialName="Mama Neema" initialArea="Westlands" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("MerchantWorkspace", () => {
  it("edits shop settings without losing the saved map coordinates", async () => {
    vi.mocked(getMerchantShop).mockResolvedValue(shop);
    vi.mocked(getMerchantProducts).mockResolvedValue([product]);
    vi.mocked(getZones).mockResolvedValue({
      items: [{ id: "zone-1", name: "Nairobi" }],
      nextCursor: null,
    });
    vi.mocked(saveMerchantShop).mockResolvedValue({
      ...shop,
      businessName: "Mama Neema Foods",
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Edit shop details" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Shop name" }), {
      target: { value: "Mama Neema Foods" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shop details" }));

    await waitFor(() => {
      expect(saveMerchantShop).toHaveBeenCalledWith({
        businessName: "Mama Neema Foods",
        category: "Groceries",
        zoneId: "zone-1",
        locationText: "Westlands",
        lat: -1.2675,
        lng: 36.8108,
        payoutPhone: "+254712345678",
      });
    });
  });

  it("edits product details and saves them through the merchant API", async () => {
    vi.mocked(getMerchantShop).mockResolvedValue(shop);
    vi.mocked(getMerchantProducts).mockResolvedValue([product]);
    vi.mocked(getZones).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(updateMerchantProduct).mockResolvedValue({
      ...product,
      name: "Ripe Avocado",
      priceKes: 65,
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit Avocado" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Product name" }), {
      target: { value: "Ripe Avocado" },
    });
    fireEvent.change(within(form).getByRole("spinbutton", { name: "Price in KES" }), {
      target: { value: "65" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateMerchantProduct).toHaveBeenCalledWith("product-1", {
        name: "Ripe Avocado",
        unit: "each",
        priceKes: 65,
        inStock: true,
      });
    });
    await waitFor(() => expect(form).not.toBeInTheDocument());
  });

  it("keeps product archival behind a confirmation", async () => {
    vi.mocked(getMerchantShop).mockResolvedValue(shop);
    vi.mocked(getMerchantProducts).mockResolvedValue([product]);
    vi.mocked(getZones).mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Archive Avocado" }));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(archiveMerchantProduct).not.toHaveBeenCalled();
  });

  it("opens voice product entry from the Shop tab", async () => {
    vi.mocked(getMerchantShop).mockResolvedValue(shop);
    vi.mocked(getMerchantProducts).mockResolvedValue([product]);
    vi.mocked(getZones).mockResolvedValue({ items: [], nextCursor: null });
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Add products by voice" }));

    expect(
      await screen.findByRole("heading", { name: "Add products by voice" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Shop" })).toBeInTheDocument();
  });

  it("saves shop availability and the seven-day schedule", async () => {
    vi.mocked(getMerchantShop).mockResolvedValue(shop);
    vi.mocked(getMerchantProducts).mockResolvedValue([product]);
    vi.mocked(getZones).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(saveMerchantAvailability).mockResolvedValue({
      ...shop,
      isOpen: true,
      openingHours: Object.fromEntries(
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
          (day) => [day, { open: false, opensAt: null, closesAt: null }],
        ),
      ),
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole("checkbox", { name: "Accepting orders now" }));
    fireEvent.click(screen.getByRole("button", { name: "Save availability" }));

    await waitFor(() => {
      expect(saveMerchantAvailability).toHaveBeenCalledWith({
        isOpen: true,
        openingHours: Object.fromEntries(
          ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
            (day) => [day, { open: false, opensAt: null, closesAt: null }],
          ),
        ),
      });
    });
  });
});
