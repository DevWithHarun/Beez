import { getAccessToken } from "@/shared/auth/session";

export type MerchantOrderStatus = "PAID" | "READY" | "PICKED_UP" | "DELIVERED" | "REJECTED";

export type MerchantOrderSummary = {
  preparingCount: number;
  readyCount: number;
  paidOrdersThisMonth: number;
  paidMerchandiseKesThisMonth: number;
};

export type MerchantOrder = {
  id: string;
  basketNo: string;
  status: MerchantOrderStatus;
  subtotalKes: number;
  paidAt: string;
  readyAt: string | null;
  customerName: string;
  customerPhone: string;
  deliveryLandmark: string;
  refundStatus: "PENDING" | "CONFIRMED" | "FAILED" | "NOT_REQUIRED" | null;
  riderName: string | null;
  riderPhone: string | null;
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPriceKes: number;
    lineTotalKes: number;
  }>;
};

export type MerchantOrderPage = {
  items: MerchantOrder[];
  nextCursor: string | null;
};

export class MerchantOrdersApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MerchantOrdersApiError";
  }
}

export async function getMerchantOrderSummary(): Promise<MerchantOrderSummary> {
  return parseSummary(await request("/api/v1/merchants/me/orders/summary"));
}

export async function getMerchantOrders(
  status?: MerchantOrderStatus,
  cursor?: string,
): Promise<MerchantOrderPage> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  const query = params.size ? `?${params.toString()}` : "";
  return parsePage(await request(`/api/v1/merchants/me/orders${query}`));
}

export async function markMerchantOrderReady(orderId: string): Promise<MerchantOrder> {
  return parseOrder(
    await request(`/api/v1/merchants/me/orders/${encodeURIComponent(orderId)}/ready`, {
      method: "PATCH",
    }),
  );
}

export async function rejectMerchantOrder(orderId: string, reason: string): Promise<MerchantOrder> {
  return parseOrder(
    await request(`/api/v1/merchants/me/orders/${encodeURIComponent(orderId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );
}

async function request(
  path: string,
  options: { method?: string; body?: string } = {},
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) {
    throw new MerchantOrdersApiError("Your sign-in session expired. Please sign in again.", 401);
  }
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
    throw new MerchantOrdersApiError(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      isRecord(payload) && typeof payload["message"] === "string"
        ? payload["message"]
        : "Your merchant orders could not be loaded. Please try again.";
    throw new MerchantOrdersApiError(message, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new MerchantOrdersApiError("Beez returned an unreadable merchant order response.");
  }
}

function parseSummary(value: unknown): MerchantOrderSummary {
  if (
    !isRecord(value) ||
    !isNonNegativeSafeInteger(value["preparingCount"]) ||
    !isNonNegativeSafeInteger(value["readyCount"]) ||
    !isNonNegativeSafeInteger(value["paidOrdersThisMonth"]) ||
    !isNonNegativeSafeInteger(value["paidMerchandiseKesThisMonth"])
  ) {
    throw new MerchantOrdersApiError("Beez returned an incomplete order summary.");
  }
  return {
    preparingCount: value["preparingCount"],
    readyCount: value["readyCount"],
    paidOrdersThisMonth: value["paidOrdersThisMonth"],
    paidMerchandiseKesThisMonth: value["paidMerchandiseKesThisMonth"],
  };
}

function parsePage(value: unknown): MerchantOrderPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value["items"]) ||
    (typeof value["nextCursor"] !== "string" && value["nextCursor"] !== null)
  ) {
    throw new MerchantOrdersApiError("Beez returned an incomplete order list.");
  }
  return {
    items: value["items"].map(parseOrder),
    nextCursor: value["nextCursor"],
  };
}

function parseOrder(value: unknown): MerchantOrder {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["id"]) ||
    !isNonEmptyString(value["basketNo"]) ||
    !isOrderStatus(value["status"]) ||
    !isNonNegativeSafeInteger(value["subtotalKes"]) ||
    !isNonEmptyString(value["paidAt"]) ||
    (typeof value["readyAt"] !== "string" && value["readyAt"] !== null) ||
    !isNonEmptyString(value["customerName"]) ||
    !isNonEmptyString(value["customerPhone"]) ||
    !isNonEmptyString(value["deliveryLandmark"]) ||
    !isRefundStatus(value["refundStatus"]) ||
    (typeof value["riderName"] !== "string" && value["riderName"] !== null) ||
    (typeof value["riderPhone"] !== "string" && value["riderPhone"] !== null) ||
    !Array.isArray(value["items"])
  ) {
    throw new MerchantOrdersApiError("Beez returned incomplete order information.");
  }
  return {
    id: value["id"],
    basketNo: value["basketNo"],
    status: value["status"],
    subtotalKes: value["subtotalKes"],
    paidAt: value["paidAt"],
    readyAt: value["readyAt"],
    customerName: value["customerName"],
    customerPhone: value["customerPhone"],
    deliveryLandmark: value["deliveryLandmark"],
    refundStatus: value["refundStatus"],
    riderName: value["riderName"],
    riderPhone: value["riderPhone"],
    items: value["items"].map(parseOrderItem),
  };
}

function parseOrderItem(value: unknown): MerchantOrder["items"][number] {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["productId"]) ||
    !isNonEmptyString(value["name"]) ||
    !isNonNegativeSafeInteger(value["qty"]) ||
    value["qty"] < 1 ||
    !isNonNegativeSafeInteger(value["unitPriceKes"]) ||
    !isNonNegativeSafeInteger(value["lineTotalKes"])
  ) {
    throw new MerchantOrdersApiError("Beez returned invalid order item information.");
  }
  return {
    productId: value["productId"],
    name: value["name"],
    qty: value["qty"],
    unitPriceKes: value["unitPriceKes"],
    lineTotalKes: value["lineTotalKes"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isOrderStatus(value: unknown): value is MerchantOrderStatus {
  return (
    value === "PAID" ||
    value === "READY" ||
    value === "PICKED_UP" ||
    value === "DELIVERED" ||
    value === "REJECTED"
  );
}

function isRefundStatus(value: unknown): value is MerchantOrder["refundStatus"] {
  return (
    value === null ||
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "FAILED" ||
    value === "NOT_REQUIRED"
  );
}
