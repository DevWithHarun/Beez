export type BeezUserSession = {
  id: string;
  role: "MERCHANT" | "RIDER";
  status: string;
  onboardingStatus: string;
  onboardingRequired: boolean;
  displayName: string | null;
  shopName: string | null;
  area: string | null;
  phone: string;
  language: string;
};

export type BeezSession = {
  accessToken: string;
  user: BeezUserSession;
};

export type ProfileUpdate = {
  displayName: string;
  language: "en" | "sw";
};

let session: BeezSession | null = null;
let refreshRequest: Promise<BeezSession | null> | null = null;
const listeners = new Set<() => void>();

export function getSession() {
  return session;
}

export function getAccessToken() {
  return session?.accessToken ?? null;
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveSession(value: BeezSession) {
  session = value;
  notify();
}

export function clearSession() {
  session = null;
  notify();
}

export async function updateProfile(input: ProfileUpdate): Promise<BeezUserSession> {
  const current = session;
  if (!current?.accessToken) {
    throw new Error("Your sign-in session expired. Please sign in again.");
  }

  let response: Response;
  try {
    response = await fetch("/api/v1/auth/me", {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.accessToken}`,
      },
      body: JSON.stringify(input),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new Error("We can’t reach Beez right now. Check your connection and try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isRecord(payload) && typeof payload["message"] === "string") {
      throw new Error(payload["message"]);
    }
    throw new Error("Your profile could not be saved. Please try again.");
  }
  if (!isRecord(payload)) {
    throw new Error("Beez returned an invalid profile. Your changes may not have been saved.");
  }

  const user = parseProfileUser(payload);
  if (user.id !== current.user.id || user.role !== current.user.role) {
    throw new Error("Beez returned a profile for a different account. Please sign in again.");
  }
  const latest = session;
  if (!latest || latest.user.id !== current.user.id || latest.user.role !== current.user.role) {
    throw new Error("Your sign-in session changed before the profile could be updated.");
  }
  saveSession({ ...latest, user });
  return user;
}

export function refreshSession(): Promise<BeezSession | null> {
  if (!refreshRequest) {
    refreshRequest = requestRefresh().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

export async function logoutSession() {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: { "X-Beez-Client": "pwa" },
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
  clearSession();
}

export async function logoutAllSessions() {
  const accessToken = getAccessToken();
  if (!accessToken) {
    clearSession();
    return;
  }
  const response = await fetch("/api/v1/auth/logout-all", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Beez-Client": "pwa",
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
  clearSession();
}

async function requestRefresh(): Promise<BeezSession | null> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "X-Beez-Client": "pwa" },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    clearSession();
    if (response.status === 401) return null;
    throw new Error(await responseError(response));
  }

  try {
    const body: unknown = await response.json();
    const refreshed = parseSession(body);
    saveSession(refreshed);
    return refreshed;
  } catch (error) {
    clearSession();
    throw error;
  }
}

export function parseSession(value: unknown): BeezSession {
  if (!isRecord(value) || typeof value["accessToken"] !== "string" || !isRecord(value["user"])) {
    throw new Error("Sign-in returned an unexpected session. Please try again.");
  }

  const user = value["user"];
  if (
    typeof user["id"] !== "string" ||
    (user["role"] !== "MERCHANT" && user["role"] !== "RIDER") ||
    typeof user["status"] !== "string" ||
    typeof user["onboardingStatus"] !== "string" ||
    typeof user["onboardingRequired"] !== "boolean" ||
    (typeof user["displayName"] !== "string" && user["displayName"] !== null) ||
    (typeof user["shopName"] !== "string" && user["shopName"] !== null) ||
    (typeof user["area"] !== "string" && user["area"] !== null) ||
    typeof user["phone"] !== "string" ||
    typeof user["language"] !== "string"
  ) {
    throw new Error("Sign-in returned incomplete account information. Please try again.");
  }

  return {
    accessToken: value["accessToken"],
    user: {
      id: user["id"],
      role: user["role"],
      status: user["status"],
      onboardingStatus: user["onboardingStatus"],
      onboardingRequired: user["onboardingRequired"],
      displayName: user["displayName"],
      shopName: user["shopName"],
      area: user["area"],
      phone: user["phone"],
      language: user["language"],
    },
  };
}

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (isRecord(body) && typeof body["message"] === "string") return body["message"];
  return "Your session could not be refreshed. Please sign in again.";
}

function notify() {
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProfileUser(value: Record<string, unknown>): BeezUserSession {
  if (
    typeof value["id"] !== "string" ||
    (value["role"] !== "MERCHANT" && value["role"] !== "RIDER") ||
    typeof value["status"] !== "string" ||
    typeof value["onboardingStatus"] !== "string" ||
    typeof value["onboardingRequired"] !== "boolean" ||
    (typeof value["displayName"] !== "string" && value["displayName"] !== null) ||
    (typeof value["shopName"] !== "string" && value["shopName"] !== null) ||
    (typeof value["area"] !== "string" && value["area"] !== null) ||
    typeof value["phone"] !== "string" ||
    typeof value["language"] !== "string"
  ) {
    throw new Error("Beez returned incomplete profile information. Please try again.");
  }
  return {
    id: value["id"],
    role: value["role"],
    status: value["status"],
    onboardingStatus: value["onboardingStatus"],
    onboardingRequired: value["onboardingRequired"],
    displayName: value["displayName"],
    shopName: value["shopName"],
    area: value["area"],
    phone: value["phone"],
    language: value["language"],
  };
}
