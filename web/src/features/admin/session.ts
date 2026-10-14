export type AdminIdentity = {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
};

export type AdminSession = {
  accessToken: string;
  expiresAt: string;
  mfaVerifiedAt: string;
  admin: AdminIdentity;
};

let session: AdminSession | null = null;
const listeners = new Set<() => void>();

export function getAdminSession() {
  return session;
}

export function subscribeToAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveAdminSession(value: AdminSession) {
  session = value;
  notify();
}

export function clearAdminSession() {
  session = null;
  notify();
}

export async function loginAdmin(email: string, password: string, authenticatorCode: string) {
  const response = await fetch("/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ email, password, authenticatorCode }),
  });
  const body: unknown = await readResponse(response);
  if (!response.ok) throw apiError(body, "Admin sign-in failed.");
  const nextSession = parseAdminSession(body);
  saveAdminSession(nextSession);
  return nextSession;
}

export async function stepUpAdmin(authenticatorCode: string) {
  const current = requireAdminSession();
  const body = await request("/api/v1/admin/auth/step-up", {
    method: "POST",
    body: JSON.stringify({ authenticatorCode }),
  });
  const nextSession = parseAdminSession(body);
  if (nextSession.admin.id !== current.admin.id) {
    clearAdminSession();
    throw new Error("The admin session changed. Sign in again.");
  }
  saveAdminSession(nextSession);
  return nextSession;
}

export async function logoutAdmin() {
  await request("/api/v1/admin/auth/logout", { method: "POST" });
  clearAdminSession();
}

export async function requestAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await request(path, init);
  return body as T;
}

async function request(path: string, init: RequestInit) {
  const current = requireAdminSession();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${current.accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const body: unknown = await readResponse(response);
  if (!response.ok) {
    const code = isRecord(body) && typeof body["error"] === "string" ? body["error"] : "";
    if (response.status === 401 && code !== "mfa_required" && code !== "mfa_invalid") {
      clearAdminSession();
    }
    throw apiError(body, "Admin request failed.");
  }
  return body;
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function parseAdminSession(value: unknown): AdminSession {
  if (!isRecord(value) || !isRecord(value["admin"])) {
    throw new Error("Admin sign-in returned an unexpected session.");
  }
  const admin = value["admin"];
  if (
    typeof value["accessToken"] !== "string" ||
    typeof value["expiresAt"] !== "string" ||
    typeof value["mfaVerifiedAt"] !== "string" ||
    !Number.isFinite(Date.parse(value["expiresAt"])) ||
    !Number.isFinite(Date.parse(value["mfaVerifiedAt"])) ||
    typeof admin["id"] !== "string" ||
    typeof admin["email"] !== "string" ||
    typeof admin["displayName"] !== "string" ||
    !Array.isArray(admin["permissions"]) ||
    !admin["permissions"].every((permission) => typeof permission === "string")
  ) {
    throw new Error("Admin sign-in returned incomplete session information.");
  }
  return {
    accessToken: value["accessToken"],
    expiresAt: value["expiresAt"],
    mfaVerifiedAt: value["mfaVerifiedAt"],
    admin: {
      id: admin["id"],
      email: admin["email"],
      displayName: admin["displayName"],
      permissions: admin["permissions"],
    },
  };
}

function requireAdminSession() {
  if (!session) throw new Error("Sign in to the admin console to continue.");
  if (Date.parse(session.expiresAt) <= Date.now()) {
    clearAdminSession();
    throw new Error("Your admin session expired. Sign in again.");
  }
  return session;
}

function apiError(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value["message"] === "string") {
    return new Error(value["message"]);
  }
  return new Error(fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function notify() {
  for (const listener of listeners) listener();
}
