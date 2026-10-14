import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MerchantDashboard from "./MerchantDashboard";
import { getMerchantDashboard } from "./api";

vi.mock("./api", () => ({
  getMerchantDashboard: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
    ...props
  }: {
    children: React.ReactNode;
    params?: { slug: string };
    to: string;
  }) => (
    <a href={params ? `/m/${params.slug}` : to} {...props}>
      {children}
    </a>
  ),
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
  isOpen: true,
  openingHours: {},
  lat: -1.2675,
  lng: 36.8108,
  payoutPhone: null,
};

const summary = (shopValue: typeof shop | null = shop) => ({
  serverTime: "2026-10-14T08:00:00Z",
  shop: shopValue,
  today: { paidOrdersToday: 3, paidMerchandiseKesToday: 1250 },
  orders: {
    preparingCount: 2,
    readyCount: 1,
    paidOrdersThisMonth: 7,
    paidMerchandiseKesThisMonth: 3450,
  },
  earnings: shopValue ? { availableKes: 900, deliveredOrders: 4, commissionPercent: 10 } : null,
  productCount: shopValue ? 2 : 0,
  inStockProductCount: shopValue ? 1 : 0,
});

function renderDashboard(
  onOpenShop = vi.fn(),
  onOpenOrders = vi.fn(),
  onOpenEarnings = vi.fn(),
  onOpenVoiceProducts = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MerchantDashboard
        onOpenShop={onOpenShop}
        onOpenOrders={onOpenOrders}
        onOpenEarnings={onOpenEarnings}
        onOpenVoiceProducts={onOpenVoiceProducts}
      />
    </QueryClientProvider>,
  );
  return { onOpenShop, onOpenOrders, onOpenEarnings, onOpenVoiceProducts };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MerchantDashboard", () => {
  it("shows live shop and catalogue summaries with working quick actions", async () => {
    vi.mocked(getMerchantDashboard).mockResolvedValue(summary());
    const { onOpenShop, onOpenOrders, onOpenEarnings, onOpenVoiceProducts } = renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Welcome to Mama Neema" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("2", { selector: "strong" })).toHaveLength(2);
      expect(screen.getAllByText("1", { selector: "strong" })).toHaveLength(2);
    });
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("KES 1,250")).toBeInTheDocument();
    expect(screen.getByText("KES 900")).toBeInTheDocument();
    expect(screen.getByText("Nairobi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /manage shop & products/i }));
    fireEvent.click(screen.getByRole("button", { name: /^orders/i }));
    fireEvent.click(screen.getByRole("button", { name: /withdraw earnings/i }));
    fireEvent.click(screen.getByRole("button", { name: /add products by voice/i }));
    expect(onOpenShop).toHaveBeenCalledOnce();
    expect(onOpenOrders).toHaveBeenCalledOnce();
    expect(onOpenEarnings).toHaveBeenCalledOnce();
    expect(onOpenVoiceProducts).toHaveBeenCalledOnce();

    expect(screen.getByRole("link", { name: /view public shop/i })).toHaveAttribute(
      "href",
      "/m/mama-neema",
    );
  });

  it("prompts a merchant without a shop to set it up and avoids showing product counts", async () => {
    vi.mocked(getMerchantDashboard).mockResolvedValue(summary(null));
    const { onOpenShop } = renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Welcome to your shop" }),
    ).toBeInTheDocument();
    expect(screen.getByText("not set up")).toBeInTheDocument();
    expect(screen.getByText("Set up your shop")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /view public shop/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add products by voice/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /set up your shop/i }));
    expect(onOpenShop).toHaveBeenCalledOnce();
  });

  it("shows a retry action when the shop overview fails", async () => {
    vi.mocked(getMerchantDashboard)
      .mockRejectedValueOnce(new Error("Shop service unavailable"))
      .mockResolvedValueOnce(summary());
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Your shop overview couldn’t load" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Shop service unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Welcome to Mama Neema" }),
    ).toBeInTheDocument();
    expect(getMerchantDashboard).toHaveBeenCalledTimes(2);
  });
});
