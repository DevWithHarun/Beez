import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MerchantProfile from "./MerchantProfile";
import { clearSession, getSession, saveSession, type BeezSession } from "@/shared/auth/session";

const originalSession: BeezSession = {
  accessToken: "test-access-token",
  user: {
    id: "merchant-user",
    role: "MERCHANT",
    status: "ACTIVE",
    onboardingStatus: "COMPLETE",
    onboardingRequired: false,
    displayName: "Amina",
    shopName: "Mama Amina",
    area: "Westlands",
    phone: "+254712345678",
    language: "en",
  },
};

function updatedProfile(overrides: Record<string, unknown> = {}) {
  return {
    ...originalSession.user,
    displayName: "Amina Wanjiku",
    language: "sw",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  clearSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MerchantProfile", () => {
  it("saves editable account fields through the profile API and updates the session", async () => {
    saveSession(originalSession);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(updatedProfile()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MerchantProfile user={originalSession.user} />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Amina Wanjiku" },
    });
    fireEvent.change(screen.getByLabelText("Preferred language"), {
      target: { value: "sw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your profile has been updated.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayName: "Amina Wanjiku", language: "sw" }),
      }),
    );
    await waitFor(() => {
      expect(getSession()?.user.displayName).toBe("Amina Wanjiku");
      expect(getSession()?.user.language).toBe("sw");
    });
    expect(getSession()?.user.shopName).toBe("Mama Amina");
  });

  it("shows API failures without changing the saved session", async () => {
    saveSession(originalSession);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Profile service unavailable." }), {
          status: 503,
        }),
      ),
    );
    render(<MerchantProfile user={originalSession.user} />);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Amina Wanjiku" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Profile service unavailable.");
    expect(getSession()?.user.displayName).toBe("Amina");
  });
});
