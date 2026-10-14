import { getAccessToken } from "@/shared/auth/session";

export type RiderState = { approved: boolean; available: boolean };
export type AvailableDelivery = {
  id: string;
  shopCount: number;
  zoneName: string;
  deliveryLandmark: string;
  createdAt: string;
};
export type ActiveDelivery = {
  id: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryLandmark: string;
  deliveryLat: number;
  deliveryLng: number;
  stops: Array<{
    orderId: string;
    stopNumber: number;
    shopName: string;
    shopPhone: string;
    shopLocation: string | null;
    status: string;
  }>;
};
export type RiderEarnings = {
  balanceKes: number;
  completedDeliveries: number;
  commissionPercent: number;
};
export type RiderLedgerEntry = {
  type: "CREDIT" | "DEBIT";
  description: string;
  amountKes: number;
  createdAt: string;
  basketNumber: string | null;
};

export class RiderApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiderApiError";
  }
}

export async function getRiderState(): Promise<RiderState> {
  const value = await request("/api/v1/riders/me/status");
  if (
    !isRecord(value) ||
    typeof value["approved"] !== "boolean" ||
    typeof value["available"] !== "boolean"
  ) {
    throw new RiderApiError("Beez returned an incomplete rider status.");
  }
  return { approved: value["approved"], available: value["available"] };
}

export async function getRiderEarnings(): Promise<RiderEarnings> {
  const value = await request("/api/v1/riders/me/earnings");
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value["balanceKes"]) ||
    !isNonNegativeInteger(value["completedDeliveries"]) ||
    !isNonNegativeInteger(value["commissionPercent"]) ||
    value["commissionPercent"] > 100
  ) {
    throw new RiderApiError("Beez returned an incomplete rider earnings summary.");
  }
  return {
    balanceKes: value["balanceKes"],
    completedDeliveries: value["completedDeliveries"],
    commissionPercent: value["commissionPercent"],
  };
}

export async function getRiderEarningsHistory(): Promise<RiderLedgerEntry[]> {
  const value = await request("/api/v1/riders/me/earnings/history");
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    throw new RiderApiError("Beez returned an incomplete rider earnings history.");
  }
  return value["items"].map(parseRiderLedgerEntry);
}

export async function getAvailableDeliveries(): Promise<AvailableDelivery[]> {
  const value = await request("/api/v1/riders/me/deliveries/available");
  if (!Array.isArray(value)) throw new RiderApiError("Beez returned an invalid delivery list.");
  return value.map(parseAvailableDelivery);
}

export async function getActiveDelivery(): Promise<ActiveDelivery | null> {
  const value = await request("/api/v1/riders/me/deliveries/active");
  return value === null ? null : parseActiveDelivery(value);
}

export async function setRiderAvailability(available: boolean): Promise<void> {
  await request("/api/v1/riders/me/availability", {
    method: "PATCH",
    body: JSON.stringify({ available }),
  });
}

export async function claimDelivery(deliveryId: string): Promise<ActiveDelivery> {
  return parseActiveDelivery(
    await request(`/api/v1/riders/me/deliveries/${encodeURIComponent(deliveryId)}/claim`, {
      method: "POST",
    }),
  );
}

export async function confirmShopPickup(
  deliveryId: string,
  orderId: string,
): Promise<ActiveDelivery> {
  return parseActiveDelivery(
    await request(
      `/api/v1/riders/me/deliveries/${encodeURIComponent(deliveryId)}/stops/${encodeURIComponent(orderId)}/pickup`,
      { method: "POST" },
    ),
  );
}

export async function confirmDelivery(
  deliveryId: string,
  code: string,
): Promise<{ status: string; message: string }> {
  const value = await request(
    `/api/v1/riders/me/deliveries/${encodeURIComponent(deliveryId)}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  );
  if (
    !isRecord(value) ||
    typeof value["status"] !== "string" ||
    typeof value["message"] !== "string"
  ) {
    throw new RiderApiError("Beez returned an incomplete delivery confirmation.");
  }
  return { status: value["status"], message: value["message"] };
}

async function request(
  path: string,
  options: { method?: string; body?: string } = {},
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw new RiderApiError("Your sign-in session expired. Please sign in again.");
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: options.body } : {}),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new RiderApiError("We can’t reach Beez right now. Check your connection and try again.");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new RiderApiError(
      isRecord(body) && typeof body["message"] === "string"
        ? body["message"]
        : "The rider request could not be completed. Please try again.",
    );
  }
  if (response.status === 204 || !response.headers.get("content-type")?.includes("json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    throw new RiderApiError("Beez returned an unreadable rider response.");
  }
}

function parseAvailableDelivery(value: unknown): AvailableDelivery {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    !isNonNegativeInteger(value["shopCount"]) ||
    typeof value["zoneName"] !== "string" ||
    typeof value["deliveryLandmark"] !== "string" ||
    typeof value["createdAt"] !== "string"
  ) {
    throw new RiderApiError("Beez returned invalid delivery information.");
  }
  return {
    id: value["id"],
    shopCount: value["shopCount"],
    zoneName: value["zoneName"],
    deliveryLandmark: value["deliveryLandmark"],
    createdAt: value["createdAt"],
  };
}

function parseRiderLedgerEntry(value: unknown): RiderLedgerEntry {
  if (
    !isRecord(value) ||
    (value["type"] !== "CREDIT" && value["type"] !== "DEBIT") ||
    typeof value["description"] !== "string" ||
    !isNonNegativeInteger(value["amountKes"]) ||
    typeof value["createdAt"] !== "string" ||
    (typeof value["basketNumber"] !== "string" && value["basketNumber"] !== null)
  ) {
    throw new RiderApiError("Beez returned invalid rider earnings history.");
  }
  return {
    type: value["type"],
    description: value["description"],
    amountKes: value["amountKes"],
    createdAt: value["createdAt"],
    basketNumber: value["basketNumber"],
  };
}

function parseActiveDelivery(value: unknown): ActiveDelivery {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    typeof value["status"] !== "string" ||
    typeof value["customerName"] !== "string" ||
    typeof value["customerPhone"] !== "string" ||
    typeof value["deliveryLandmark"] !== "string" ||
    typeof value["deliveryLat"] !== "number" ||
    typeof value["deliveryLng"] !== "number" ||
    !Array.isArray(value["stops"])
  ) {
    throw new RiderApiError("Beez returned incomplete active delivery details.");
  }
  return {
    id: value["id"],
    status: value["status"],
    customerName: value["customerName"],
    customerPhone: value["customerPhone"],
    deliveryLandmark: value["deliveryLandmark"],
    deliveryLat: value["deliveryLat"],
    deliveryLng: value["deliveryLng"],
    stops: value["stops"].map((stop) => {
      if (
        !isRecord(stop) ||
        typeof stop["orderId"] !== "string" ||
        !isPositiveInteger(stop["stopNumber"]) ||
        typeof stop["shopName"] !== "string" ||
        typeof stop["shopPhone"] !== "string" ||
        (typeof stop["shopLocation"] !== "string" && stop["shopLocation"] !== null) ||
        typeof stop["status"] !== "string"
      ) {
        throw new RiderApiError("Beez returned an invalid pickup stop.");
      }
      return {
        orderId: stop["orderId"],
        stopNumber: stop["stopNumber"],
        shopName: stop["shopName"],
        shopPhone: stop["shopPhone"],
        shopLocation: stop["shopLocation"],
        status: stop["status"],
      };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
