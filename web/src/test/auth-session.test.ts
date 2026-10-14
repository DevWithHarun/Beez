import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  getAccessToken,
  getSession,
  logoutSession,
  logoutAllSessions,
  parseSession,
  refreshSession,
  saveSession,
} from "@/shared/auth/session";

const sessionPayload = {
  accessToken: "short-lived-access-token",
  tokenType: "Bearer",
  expiresIn: 900,
  refreshExpiresAt: "2026-11-01T00:00:00Z",
  user: {
    id: "f80ac351-34d4-4af8-a3df-4308ed3c2a98",
    role: "MERCHANT",
    status: "ACTIVE",
    onboardingStatus: "ONBOARDING",
    onboardingRequired: true,
    displayName: null,
    shopName: null,
    area: null,
    phone: "+254712345678",
    language: "sw",
  },
};

describe("in-memory auth session", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("stores the access token and user only in the in-memory session", () => {
    const session = parseSession(sessionPayload);
    saveSession(session);

    expect(getAccessToken()).toBe("short-lived-access-token");
    expect(getSession()?.user.phone).toBe("+254712345678");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("rejects incomplete session responses", () => {
    expect(() => parseSession({ accessToken: "token", user: {} })).toThrow(
      "Sign-in returned incomplete account information.",
    );
  });

  it("coalesces concurrent refresh calls and stores the rotated access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sessionPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    );
    expect(first).toEqual(second);
    expect(getAccessToken()).toBe("short-lived-access-token");
  });

  it("clears memory after successful server logout", async () => {
    saveSession(parseSession(sessionPayload));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await logoutSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include", cache: "no-store" }),
    );
    expect(getSession()).toBeNull();
  });

  it("sends the in-memory access token for logout-all", async () => {
    saveSession(parseSession(sessionPayload));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await logoutAllSessions();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/logout-all",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer short-lived-access-token",
        }),
        cache: "no-store",
      }),
    );
    expect(getSession()).toBeNull();
  });
});
