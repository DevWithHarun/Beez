import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "@/shared/auth/session";
import {
  getActiveDelivery,
  getRiderEarnings,
  getRiderEarningsHistory,
  getRiderState,
  setRiderAvailability,
} from "./api";

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe("rider API", () => {
  it("loads approval/availability and sends an authenticated no-store availability update", async () => {
    saveSession({
      accessToken: "test-access-token",
      user: {
        id: "rider-1",
        role: "RIDER",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Test Rider",
        shopName: null,
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ approved: true, available: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRiderState()).resolves.toEqual({ approved: true, available: false });
    await setRiderAvailability(true);
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/v1/riders/me/availability");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ available: true });
    expect(options.cache).toBe("no-store");
  });

  it("accepts the empty response used when there is no active delivery", async () => {
    saveSession({
      accessToken: "test-access-token",
      user: {
        id: "rider-1",
        role: "RIDER",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Test Rider",
        shopName: null,
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(getActiveDelivery()).resolves.toBeNull();
  });

  it("loads the authenticated no-store rider earnings summary and history", async () => {
    saveSession({
      accessToken: "test-access-token",
      user: {
        id: "rider-1",
        role: "RIDER",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Test Rider",
        shopName: null,
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ balanceKes: 950, completedDeliveries: 1, commissionPercent: 5 }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                type: "CREDIT",
                description: "Rider earnings after verified delivery",
                amountKes: 950,
                createdAt: "2026-10-13T12:00:00Z",
                basketNumber: "BZ-001",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRiderEarnings()).resolves.toEqual({
      balanceKes: 950,
      completedDeliveries: 1,
      commissionPercent: 5,
    });
    await expect(getRiderEarningsHistory()).resolves.toEqual([
      {
        type: "CREDIT",
        description: "Rider earnings after verified delivery",
        amountKes: 950,
        createdAt: "2026-10-13T12:00:00Z",
        basketNumber: "BZ-001",
      },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/riders/me/earnings");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/riders/me/earnings/history");
    for (const [, options] of fetchMock.mock.calls) {
      expect((options as RequestInit).cache).toBe("no-store");
      expect((options as RequestInit).credentials).toBe("omit");
    }
  });
});
