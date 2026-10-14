import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "@/shared/auth/session";
import {
  getMerchantOrderSummary,
  getMerchantOrders,
  markMerchantOrderReady,
  rejectMerchantOrder,
  MerchantOrdersApiError,
} from "./orders";

const session = {
  accessToken: "test-access-token",
  user: {
    id: "user-1",
    role: "MERCHANT" as const,
    status: "ACTIVE",
    onboardingStatus: "COMPLETE",
    onboardingRequired: false,
    displayName: "Test Merchant",
    shopName: "Test Shop",
    area: "Nairobi",
    phone: "+254712345678",
    language: "en",
  },
};

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("merchant order API", () => {
  it("sends authenticated, non-cacheable summary requests and parses totals", async () => {
    saveSession(session);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          preparingCount: 2,
          readyCount: 1,
          paidOrdersThisMonth: 10,
          paidMerchandiseKesThisMonth: 7200,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const summary = await getMerchantOrderSummary();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("/api/v1/merchants/me/orders/summary");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-access-token");
    expect(options.cache).toBe("no-store");
    expect(summary.paidMerchandiseKesThisMonth).toBe(7200);
  });

  it("encodes status and cursor query parameters and uses PATCH for ready actions", async () => {
    saveSession(session);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "order-1",
            basketNo: "BZ-001001",
            status: "READY",
            subtotalKes: 250,
            paidAt: "2026-10-12T10:00:00Z",
            readyAt: "2026-10-12T10:05:00Z",
            customerName: "A Customer",
            customerPhone: "+254712345678",
            deliveryLandmark: "Westlands",
            refundStatus: null,
            riderName: null,
            riderPhone: null,
            items: [],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getMerchantOrders("READY", "cursor value");
    const pageUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(pageUrl).toBe("/api/v1/merchants/me/orders?status=READY&cursor=cursor+value");

    const updated = await markMerchantOrderReady("order-1");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/merchants/me/orders/order-1/ready");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH");
    expect(updated.status).toBe("READY");
  });

  it("submits a rejection reason and parses refund and rider fields", async () => {
    saveSession(session);
    const response = {
      id: "order-1",
      basketNo: "BZ-001001",
      status: "REJECTED",
      subtotalKes: 250,
      paidAt: "2026-10-12T10:00:00Z",
      readyAt: null,
      customerName: "A Customer",
      customerPhone: "+254712345678",
      deliveryLandmark: "Westlands",
      refundStatus: "PENDING",
      riderName: null,
      riderPhone: null,
      items: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await rejectMerchantOrder("order-1", "Out of stock");
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/merchants/me/orders/order-1/reject");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ reason: "Out of stock" });
    expect(result.refundStatus).toBe("PENDING");
    expect(result.riderName).toBeNull();
  });

  it("rejects invalid response shapes rather than displaying invented data", async () => {
    saveSession(session);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ preparingCount: -1 }), { status: 200 })),
    );

    await expect(getMerchantOrderSummary()).rejects.toBeInstanceOf(MerchantOrdersApiError);
  });

  it("reports API errors explicitly", async () => {
    saveSession(session);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "Order service unavailable" }), { status: 503 }),
        ),
    );

    await expect(getMerchantOrderSummary()).rejects.toThrow("Order service unavailable");
  });
});
