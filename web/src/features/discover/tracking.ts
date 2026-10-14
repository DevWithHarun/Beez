const TRACKING_TOKEN_KEY = "beez.guest-basket-token.v1";
const DELIVERY_CODE_KEY = "beez.guest-delivery-code.v1";

export function saveTrackingToken(token: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(TRACKING_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function readTrackingToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TRACKING_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveDeliveryCode(token: string, code: string): boolean {
  if (
    typeof window === "undefined" ||
    !/^[A-Za-z0-9_-]{40,60}$/.test(token) ||
    !/^\d{6}$/.test(code)
  ) {
    return false;
  }
  try {
    window.sessionStorage.setItem(DELIVERY_CODE_KEY, JSON.stringify({ token, code }));
    return true;
  } catch {
    return false;
  }
}

export function readDeliveryCode(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(DELIVERY_CODE_KEY) ?? "null");
    if (
      typeof value === "object" &&
      value !== null &&
      "token" in value &&
      value.token === token &&
      "code" in value &&
      typeof value.code === "string" &&
      /^\d{6}$/.test(value.code)
    ) {
      return value.code;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDeliveryCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DELIVERY_CODE_KEY);
  } catch {
    return;
  }
}
