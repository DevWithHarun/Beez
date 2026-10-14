import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBasket,
  createGuestIdempotencyKey,
  DiscoverApiError,
  getBasket,
  getShop,
  getShops,
  getZones,
  startBasketPayment,
} from "./api";

describe("public Discover API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads service areas without caching the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ id: "zone-1", name: "Central Market" }], nextCursor: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getZones()).resolves.toEqual({
      items: [{ id: "zone-1", name: "Central Market" }],
      nextCursor: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/zones",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("requests the next service-area page with its cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await getZones("zone-next");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/public/zones?cursor=zone-next");
  });

  it("passes zone, category, search and cursor as encoded query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await getShops({
      zone: "zone-1",
      category: "Fresh food",
      query: "red tomatoes",
      cursor: "next-page",
    });

    const request = fetchMock.mock.calls[0];
    if (!request) throw new Error("Expected a shop request.");
    const url = new URL(request[0], "http://localhost");
    expect(url.pathname).toBe("/api/v1/public/shops");
    expect(url.searchParams.get("zone")).toBe("zone-1");
    expect(url.searchParams.get("category")).toBe("Fresh food");
    expect(url.searchParams.get("q")).toBe("red tomatoes");
    expect(url.searchParams.get("cursor")).toBe("next-page");
  });

  it("rejects invalid product prices from shop pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: "shop-1",
          slug: "mama-neema",
          name: "Mama Neema",
          category: "Groceries",
          zoneId: "zone-1",
          zoneName: "Central Market",
          locationText: null,
          isOpen: true,
          products: [{ id: "product-1", name: "Rice", unit: "kg", priceKes: 12.5, inStock: true }],
        }),
      ),
    );

    await expect(getShop("mama-neema")).rejects.toThrow("Beez returned an invalid product.");
  });

  it("does not request a malformed or unsafe shop slug", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShop("../private")).rejects.toBeInstanceOf(DiscoverApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the backend's public error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "This shop is not available." }, 404)),
    );

    await expect(getShop("closed-shop")).rejects.toThrow("This shop is not available.");
  });

  it("reports an unavailable discovery API instead of returning fake data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getZones()).rejects.toThrow(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  });

  it("creates a guest basket without credentials and accepts only a server quote", async () => {
    const response = {
      basketNo: "BZ-001001",
      trackingToken: "a".repeat(43),
      itemsTotalKes: 100,
      deliveryFeeKes: 100,
      totalKes: 200,
      status: "PENDING_PAYMENT",
      expiresAt: "2026-01-01T00:15:00Z",
      vendors: [
        {
          merchantId: "merchant-1",
          name: "Shop",
          slug: "shop",
          subtotalKes: 100,
          status: "AWAITING_PAYMENT",
          refundStatus: null,
        },
      ],
      lines: [
        {
          productId: "product-1",
          name: "Rice",
          qty: 1,
          unitPriceKes: 100,
          lineTotalKes: 100,
          merchantId: "merchant-1",
          shopName: "Shop",
          shopSlug: "shop",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response, 201));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    const key = createGuestIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await expect(
      createBasket(
        {
          zoneId: "zone-1",
          lines: [{ productId: "product-1", qty: 1 }],
          customer: { name: "Customer", phone: "0712345678" },
          delivery: { lat: -1.28, lng: 36.82, landmark: "Market gate" },
        },
        key,
      ),
    ).resolves.toMatchObject({ totalKes: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/baskets",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        }),
      }),
    );
  });

  it("loads a guest basket by capability without caching or referrer leakage", async () => {
    const response = {
      basketNo: "BZ-001001",
      trackingToken: "b".repeat(43),
      itemsTotalKes: 100,
      deliveryFeeKes: 100,
      totalKes: 200,
      status: "PENDING_PAYMENT",
      expiresAt: "2026-01-01T00:15:00Z",
      vendors: [
        {
          merchantId: "merchant-1",
          name: "Shop",
          slug: "shop",
          subtotalKes: 100,
          status: "PAID",
          refundStatus: null,
        },
      ],
      lines: [
        {
          productId: "product-1",
          name: "Rice",
          qty: 1,
          unitPriceKes: 100,
          lineTotalKes: 100,
          merchantId: "merchant-1",
          shopName: "Shop",
          shopSlug: "shop",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBasket("b".repeat(43))).resolves.toMatchObject({ basketNo: "BZ-001001" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/public/baskets/${"b".repeat(43)}`,
      expect.objectContaining({
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("surfaces unavailable payment instead of treating the request as paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message:
              "M-Pesa sandbox checkout is not configured yet. Your basket has not been charged.",
          },
          503,
        ),
      ),
    );

    await expect(startBasketPayment("a".repeat(43))).rejects.toThrow(
      "M-Pesa sandbox checkout is not configured yet. Your basket has not been charged.",
    );
  });

  it("returns the customer delivery code with the payment-start response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          paymentId: "payment-1",
          status: "PENDING",
          message: "Check your phone.",
          deliveryCode: "123456",
        }),
      ),
    );

    await expect(startBasketPayment("a".repeat(43))).resolves.toMatchObject({
      status: "PENDING",
      deliveryCode: "123456",
    });
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
