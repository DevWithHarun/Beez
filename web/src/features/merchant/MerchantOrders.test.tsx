import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MerchantOrders from "./MerchantOrders";
import { getMerchantOrders, markMerchantOrderReady, rejectMerchantOrder } from "./orders";
import { getSession } from "@/shared/auth/session";
import {
  listQueuedReadyActions,
  queueReadyAction,
  removeQueuedReadyAction,
} from "./offlineReadyQueue";

vi.mock("./orders", () => ({
  getMerchantOrders: vi.fn(),
  markMerchantOrderReady: vi.fn(),
  rejectMerchantOrder: vi.fn(),
}));

vi.mock("@/shared/auth/session", () => ({
  getSession: vi.fn(() => null),
}));

vi.mock("./offlineReadyQueue", () => ({
  listQueuedReadyActions: vi.fn().mockResolvedValue([]),
  markQueuedReadyConflict: vi.fn(),
  queueReadyAction: vi.fn(),
  removeQueuedReadyAction: vi.fn(),
}));

const paidOrder = {
  id: "order-1",
  basketNo: "BZ-001001",
  status: "PAID" as const,
  subtotalKes: 250,
  paidAt: "2026-10-12T10:00:00Z",
  readyAt: null,
  customerName: "A Customer",
  customerPhone: "+254712345678",
  deliveryLandmark: "Westlands near the market",
  refundStatus: null,
  riderName: null,
  riderPhone: null,
  items: [
    {
      productId: "product-1",
      name: "Avocado",
      qty: 2,
      unitPriceKes: 125,
      lineTotalKes: 250,
    },
  ],
};

function renderOrders() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MerchantOrders />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.mocked(getSession).mockReturnValue(null);
  vi.mocked(listQueuedReadyActions).mockResolvedValue([]);
  vi.mocked(queueReadyAction).mockResolvedValue(undefined);
  vi.mocked(removeQueuedReadyAction).mockResolvedValue(undefined);
});

describe("MerchantOrders", () => {
  it("shows paid order details and marks an order ready after confirmation", async () => {
    vi.mocked(getMerchantOrders)
      .mockResolvedValueOnce({ items: [paidOrder], nextCursor: null })
      .mockResolvedValue({ items: [{ ...paidOrder, status: "READY" }], nextCursor: null });
    vi.mocked(markMerchantOrderReady).mockResolvedValue({
      ...paidOrder,
      status: "READY",
      readyAt: "2026-10-12T10:05:00Z",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderOrders();

    expect(await screen.findByRole("heading", { name: "Voice Orders" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "BZ-001001" })).toBeInTheDocument();
    expect(screen.getByText("2 × Avocado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+254712345678" })).toHaveAttribute(
      "href",
      "tel:+254712345678",
    );
    expect(screen.getByText("Westlands near the market")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mark ready for pickup/i }));

    await waitFor(() =>
      expect(vi.mocked(markMerchantOrderReady).mock.calls[0]?.[0]).toBe("order-1"),
    );
    expect(await screen.findByText("BZ-001001 is ready for pickup.")).toBeInTheDocument();
    expect(await screen.findByText("Ready for pickup")).toBeInTheDocument();
  });

  it("keeps the order unchanged when the merchant cancels the confirmation", async () => {
    vi.mocked(getMerchantOrders).mockResolvedValue({ items: [paidOrder], nextCursor: null });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderOrders();

    fireEvent.click(await screen.findByRole("button", { name: /mark ready for pickup/i }));

    expect(markMerchantOrderReady).not.toHaveBeenCalled();
    expect(screen.getAllByText("Preparing")).not.toHaveLength(0);
  });

  it("rejects a paid order with a reason and explains the external refund workflow", async () => {
    vi.mocked(getMerchantOrders).mockResolvedValue({ items: [paidOrder], nextCursor: null });
    vi.mocked(rejectMerchantOrder).mockResolvedValue({
      ...paidOrder,
      status: "REJECTED",
      refundStatus: "PENDING",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderOrders();

    fireEvent.click(await screen.findByRole("button", { name: /reject order/i }));
    fireEvent.change(screen.getByLabelText("Reason for rejection"), {
      target: { value: "Out of stock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject and request refund" }));

    await waitFor(() =>
      expect(rejectMerchantOrder).toHaveBeenCalledWith("order-1", "Out of stock"),
    );
    expect(
      await screen.findByText(
        "BZ-001001 was rejected. The customer refund request is pending Beez operations.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a useful empty state and an explicit load error", async () => {
    vi.mocked(getMerchantOrders)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new Error("Orders temporarily unavailable"));
    renderOrders();

    expect(await screen.findByText("No paid orders yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Orders temporarily unavailable")).toBeInTheDocument();
  });

  it("queues only a Ready action while offline and syncs it after reconnecting", async () => {
    const action = { userId: "user-1", orderId: "order-1", createdAt: 1 };
    vi.mocked(getSession).mockReturnValue({
      accessToken: "token",
      user: {
        id: "user-1",
        role: "MERCHANT",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Merchant",
        shopName: "Shop",
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    let queued = false;
    let synced = false;
    vi.mocked(listQueuedReadyActions).mockImplementation(async () =>
      queued && !synced ? [action] : [],
    );
    vi.mocked(queueReadyAction).mockImplementation(async () => {
      queued = true;
    });
    vi.mocked(removeQueuedReadyAction).mockImplementation(async () => {
      synced = true;
    });
    vi.mocked(markMerchantOrderReady).mockResolvedValue({
      ...paidOrder,
      status: "READY",
      readyAt: "2026-10-12T10:05:00Z",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    renderOrders();

    fireEvent.click(await screen.findByRole("button", { name: /mark ready for pickup/i }));

    await waitFor(() => expect(queueReadyAction).toHaveBeenCalledWith("user-1", "order-1"));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent(window, new Event("online"));

    await waitFor(() => expect(markMerchantOrderReady).toHaveBeenCalledWith("order-1"));
    expect(removeQueuedReadyAction).toHaveBeenCalledWith(action);
    expect(
      await screen.findByText("BZ-001001 is ready for pickup. Saved offline and synced."),
    ).toBeInTheDocument();
  });
});
