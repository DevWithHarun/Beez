import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";
import { clearAdminSession } from "./session";

const session = {
  accessToken: "admin-access-token",
  tokenType: "Bearer",
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  mfaVerifiedAt: new Date().toISOString(),
  admin: {
    id: "admin-1",
    email: "ops@example.test",
    displayName: "Beez Operations",
    permissions: ["rider:approve", "refund:resolve"],
  },
};

const riders = {
  items: [
    {
      userId: "rider-1",
      displayName: "Amina Njeri",
      phoneMasked: "••••••5678",
      area: "Westlands",
      createdAt: "2026-10-12T10:00:00Z",
    },
  ],
};

const refunds = {
  items: [
    {
      id: "refund-1",
      orderId: "order-1",
      basketNo: "BZ-1024",
      merchantName: "Mama Neema",
      customerPhoneMasked: "••••••3456",
      amountKes: 6400,
      reason: "Item unavailable",
      requestedAt: "2026-10-12T09:00:00Z",
    },
  ],
};

const merchants = {
  items: [
    {
      merchantId: "merchant-1",
      userId: "merchant-user-1",
      businessName: "Real Shop",
      category: "Groceries",
      zoneName: "Nairobi",
      locationText: "Westlands",
      ownerName: "Njeri",
      ownerPhoneMasked: "••••••4321",
      createdAt: "2026-10-12T08:00:00Z",
    },
  ],
};

const withdrawals = {
  items: [
    {
      id: "withdrawal-1",
      merchantUserId: "merchant-user-1",
      merchantName: "Njeri",
      businessName: "Real Shop",
      payoutPhone: "+254700001234",
      amountKes: 1200,
      status: "REQUESTED",
      requestedAt: "2026-10-12T08:30:00Z",
      processingAt: null,
      processingBy: null,
      providerReference: null,
    },
  ],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboard />
    </QueryClientProvider>,
  );
}

function mockFetch(loginSession = session) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/admin/auth/login")) {
      return new Response(JSON.stringify(loginSession), { status: 200 });
    }
    if (url.endsWith("/admin/auth/step-up")) {
      return new Response(JSON.stringify(session), { status: 200 });
    }
    if (url.endsWith("/operations/riders/pending")) {
      return new Response(JSON.stringify(riders), { status: 200 });
    }
    if (url.endsWith("/operations/dashboard")) {
      return new Response(
        JSON.stringify({
          ordersToday: 0,
          paidTodayKes: 0,
          activeMerchants: 0,
          activeRiders: 0,
          averageDeliveryMinutes: 18,
          openDeliveries: 0,
          failedDeliveries: 0,
          pendingMerchantApprovals: 0,
          pendingRiderApprovals: 1,
          paymentIssues: 2,
          pendingWithdrawals: 0,
          pendingRefunds: 0,
          attentionItems: 3,
          asOf: "2026-10-13T12:00:00Z",
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/operations/merchants/pending")) {
      return new Response(JSON.stringify(merchants), { status: 200 });
    }
    if (url.endsWith("/operations/refunds/pending")) {
      return new Response(JSON.stringify(refunds), { status: 200 });
    }
    if (url.endsWith("/operations/withdrawals/pending")) {
      return new Response(JSON.stringify(withdrawals), { status: 200 });
    }
    if (url.endsWith("/operations/merchants/merchant-1/approve")) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/operations/orders")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.endsWith("/operations/payments")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.endsWith("/operations/exceptions")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.endsWith("/operations/ledger")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.includes("/operations/users")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.includes("/operations/audit")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.endsWith("/riders/rider-1/approve")) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/admin/auth/logout")) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  clearAdminSession();
  vi.unstubAllGlobals();
});

describe("AdminDashboard", () => {
  it("requires separate admin sign-in and then loads live queues", async () => {
    const fetchMock = mockFetch();
    renderDashboard();

    expect(screen.getByRole("heading", { name: /admin console/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Admin email")).toBeInTheDocument();
    expect(screen.queryByText("KES 8.4M")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "ops@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

    expect(await screen.findByText("Amina Njeri")).toBeInTheDocument();
    expect(await screen.findByText("Real Shop")).toBeInTheDocument();
    expect(screen.getByText("Mama Neema · Order BZ-1024")).toBeInTheDocument();
    expect(screen.getByText(/payout to \+254700001234/)).toBeInTheDocument();
    expect(screen.getByText(/••••••5678/)).toBeInTheDocument();
    expect(screen.getByText("18 min")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Work queues needing attention" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rider applications 1" })).toHaveAttribute(
      "href",
      "#approvals",
    );
    expect(screen.getByRole("link", { name: "Payment issues 2" })).toHaveAttribute(
      "href",
      "#exceptions",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/auth/login",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(screen.getByText("LIVE DATABASE · REFRESHES EVERY 30 SECONDS")).toBeInTheDocument();
  });

  it("refreshes the Overview on demand and exposes the last update time", async () => {
    const fetchMock = mockFetch();
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "ops@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));

    const refresh = await screen.findByRole("button", { name: "Refresh overview" });
    expect(screen.getByText(/Last updated 13 Oct 2026, 15:00 EAT/)).toBeInTheDocument();
    fireEvent.click(refresh);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/operations/dashboard")),
      ).toHaveLength(2);
    });
  });

  it("reviews a database-backed merchant application with a recorded reason", async () => {
    const fetchMock = mockFetch();
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "ops@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));
    await screen.findByText("Real Shop");

    fireEvent.change(screen.getByLabelText("Review reason"), {
      target: { value: "Verified shop details" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve merchant" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/operations/merchants/merchant-1/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Verified shop details" }),
        }),
      );
    });
  });

  it("requires a fresh step-up before rider approval and refreshes the queue", async () => {
    const fetchMock = mockFetch();
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "ops@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));
    await screen.findByText("Amina Njeri");
    await screen.findByText("Mama Neema · Order BZ-1024");

    fireEvent.click(screen.getByRole("button", { name: /approve rider/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/operations/riders/rider-1/approve",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/admin/auth/step-up", expect.anything());
    expect(await screen.findByRole("status")).toHaveTextContent(/operation completed/i);
  });

  it("steps up with a new authenticator code after the ten-minute window", async () => {
    const expiredMfaSession = {
      ...session,
      mfaVerifiedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    };
    const fetchMock = mockFetch(expiredMfaSession);
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "ops@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in securely/i }));
    await screen.findByText("Amina Njeri");

    const codes = screen.getAllByLabelText("Authenticator code");
    fireEvent.change(codes[1]!, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /approve rider/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/auth/step-up",
        expect.objectContaining({ method: "POST" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/operations/riders/rider-1/approve",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
