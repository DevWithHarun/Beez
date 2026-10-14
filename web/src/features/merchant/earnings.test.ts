import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "@/shared/auth/session";
import {
  getMerchantEarnings,
  getMerchantLedgerHistory,
  getMerchantWithdrawals,
  requestMerchantWithdrawal,
} from "./earnings";

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe("merchant earnings API", () => {
  it("loads a non-cacheable ledger summary and history with the merchant session", async () => {
    saveSession({
      accessToken: "test-access-token",
      user: {
        id: "merchant-1",
        role: "MERCHANT",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Test Merchant",
        shopName: "Test Shop",
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ availableKes: 950, deliveredOrders: 1, commissionPercent: 5 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                type: "CREDIT",
                description: "Merchant earnings after verified delivery",
                amountKes: 950,
                createdAt: "2026-10-12T10:00:00Z",
                orderNumber: "BZ-001001",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMerchantEarnings()).resolves.toEqual({
      availableKes: 950,
      deliveredOrders: 1,
      commissionPercent: 5,
    });
    await expect(getMerchantLedgerHistory()).resolves.toMatchObject([
      { type: "CREDIT", amountKes: 950, orderNumber: "BZ-001001" },
    ]);
    for (const [, options] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(options.cache).toBe("no-store");
      expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-access-token");
    }
  });

  it("submits a real withdrawal request and loads its recorded status", async () => {
    saveSession({
      accessToken: "test-access-token",
      user: {
        id: "merchant-1",
        role: "MERCHANT",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        onboardingRequired: false,
        displayName: "Test Merchant",
        shopName: "Test Shop",
        area: "Nairobi",
        phone: "+254712345678",
        language: "en",
      },
    });
    const withdrawal = {
      id: "withdrawal-1",
      amountKes: 750,
      status: "REQUESTED",
      payoutPhone: "••••••5678",
      requestedAt: "2026-10-12T10:00:00Z",
      resolvedAt: null,
      providerReference: null,
      resolutionNote: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(withdrawal), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [withdrawal] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestMerchantWithdrawal(750)).resolves.toMatchObject({
      id: "withdrawal-1",
      amountKes: 750,
      status: "REQUESTED",
    });
    await expect(getMerchantWithdrawals()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/merchants/me/earnings/withdrawals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amountKes: 750 }),
        cache: "no-store",
      }),
    );
  });
});
