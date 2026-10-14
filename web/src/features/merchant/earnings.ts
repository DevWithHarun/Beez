import { getAccessToken } from "@/shared/auth/session";

export type MerchantEarnings = {
  availableKes: number;
  deliveredOrders: number;
  commissionPercent: number;
};

export type MerchantLedgerEntry = {
  type: "CREDIT" | "DEBIT";
  description: string;
  amountKes: number;
  createdAt: string;
  orderNumber: string | null;
};

export type MerchantWithdrawal = {
  id: string;
  amountKes: number;
  status: "REQUESTED" | "PROCESSING" | "PAID" | "REJECTED";
  payoutPhone: string;
  requestedAt: string;
  resolvedAt: string | null;
  providerReference: string | null;
  resolutionNote: string | null;
};

export class MerchantEarningsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MerchantEarningsApiError";
  }
}

export async function getMerchantEarnings(): Promise<MerchantEarnings> {
  const value = await request("/api/v1/merchants/me/earnings");
  if (
    !isRecord(value) ||
    !isNonNegativeSafeInteger(value["availableKes"]) ||
    !isNonNegativeSafeInteger(value["deliveredOrders"]) ||
    !isNonNegativeSafeInteger(value["commissionPercent"]) ||
    value["commissionPercent"] > 100
  ) {
    throw new MerchantEarningsApiError("Beez returned an incomplete earnings summary.");
  }
  return {
    availableKes: value["availableKes"],
    deliveredOrders: value["deliveredOrders"],
    commissionPercent: value["commissionPercent"],
  };
}

export async function getMerchantLedgerHistory(): Promise<MerchantLedgerEntry[]> {
  const value = await request("/api/v1/merchants/me/earnings/history");
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    throw new MerchantEarningsApiError("Beez returned an incomplete earnings history.");
  }
  return value["items"].map(parseEntry);
}

export async function getMerchantWithdrawals(): Promise<MerchantWithdrawal[]> {
  const value = await request("/api/v1/merchants/me/earnings/withdrawals");
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    throw new MerchantEarningsApiError("Beez returned an incomplete withdrawal history.");
  }
  return value["items"].map(parseWithdrawal);
}

export async function requestMerchantWithdrawal(amountKes: number): Promise<MerchantWithdrawal> {
  return parseWithdrawal(
    await request("/api/v1/merchants/me/earnings/withdrawals", {
      method: "POST",
      body: JSON.stringify({ amountKes }),
    }),
  );
}

async function request(
  path: string,
  options: { method?: string; body?: string } = {},
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) {
    throw new MerchantEarningsApiError("Your sign-in session expired. Please sign in again.");
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
    throw new MerchantEarningsApiError(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new MerchantEarningsApiError(
      isRecord(body) && typeof body["message"] === "string"
        ? body["message"]
        : "Your merchant earnings could not be loaded. Please try again.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new MerchantEarningsApiError("Beez returned an unreadable earnings response.");
  }
}

function parseWithdrawal(value: unknown): MerchantWithdrawal {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    !isNonNegativeSafeInteger(value["amountKes"]) ||
    !["REQUESTED", "PROCESSING", "PAID", "REJECTED"].includes(String(value["status"])) ||
    typeof value["payoutPhone"] !== "string" ||
    typeof value["requestedAt"] !== "string" ||
    (typeof value["resolvedAt"] !== "string" && value["resolvedAt"] !== null) ||
    (typeof value["providerReference"] !== "string" && value["providerReference"] !== null) ||
    (typeof value["resolutionNote"] !== "string" && value["resolutionNote"] !== null)
  ) {
    throw new MerchantEarningsApiError("Beez returned invalid withdrawal information.");
  }
  return {
    id: value["id"],
    amountKes: value["amountKes"],
    status: value["status"] as MerchantWithdrawal["status"],
    payoutPhone: value["payoutPhone"],
    requestedAt: value["requestedAt"],
    resolvedAt: value["resolvedAt"],
    providerReference: value["providerReference"],
    resolutionNote: value["resolutionNote"],
  };
}

function parseEntry(value: unknown): MerchantLedgerEntry {
  if (
    !isRecord(value) ||
    (value["type"] !== "CREDIT" && value["type"] !== "DEBIT") ||
    typeof value["description"] !== "string" ||
    !isNonNegativeSafeInteger(value["amountKes"]) ||
    typeof value["createdAt"] !== "string" ||
    (typeof value["orderNumber"] !== "string" && value["orderNumber"] !== null)
  ) {
    throw new MerchantEarningsApiError("Beez returned invalid earnings history.");
  }
  return {
    type: value["type"],
    description: value["description"],
    amountKes: value["amountKes"],
    createdAt: value["createdAt"],
    orderNumber: value["orderNumber"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
