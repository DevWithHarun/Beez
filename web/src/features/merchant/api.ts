import { getAccessToken } from "@/shared/auth/session";

export type MerchantShop = {
  id: string;
  slug: string;
  businessName: string;
  category: string;
  zoneId: string;
  zoneName: string;
  locationText: string;
  status: string;
  isOpen: boolean;
  openingHours: Record<string, BusinessHours>;
  lat: number;
  lng: number;
  payoutPhone: string | null;
};

export type BusinessHours = {
  open: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

export type MerchantAvailabilityInput = {
  isOpen: boolean;
  openingHours: Record<string, BusinessHours>;
};

export type MerchantDashboard = {
  serverTime: string;
  shop: MerchantShop | null;
  today: { paidOrdersToday: number; paidMerchandiseKesToday: number };
  orders: {
    preparingCount: number;
    readyCount: number;
    paidOrdersThisMonth: number;
    paidMerchandiseKesThisMonth: number;
  };
  earnings: { availableKes: number; deliveredOrders: number; commissionPercent: number } | null;
  productCount: number;
  inStockProductCount: number;
};

export type MerchantProduct = {
  id: string;
  name: string;
  unit: string | null;
  priceKes: number;
  inStock: boolean;
};

export type MerchantShopInput = {
  businessName: string;
  category: string;
  zoneId: string;
  locationText: string;
  lat: number;
  lng: number;
  payoutPhone?: string;
};

export type MerchantProductInput = {
  name: string;
  unit: string | null;
  priceKes: number;
  inStock: boolean;
};

export type VoiceProductDraft = {
  name: string;
  unit: string | null;
  priceKes: number;
  confidence: number;
  sourcePhrase: string;
};

export type VoiceProductExtraction = {
  transcript: string;
  products: VoiceProductDraft[];
  unparsedPhrases: string[];
};

export class MerchantApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MerchantApiError";
  }
}

export async function getMerchantShop(): Promise<MerchantShop | null> {
  try {
    return parseShop(await request("/api/v1/merchants/me/shop"));
  } catch (error) {
    if (error instanceof MerchantApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getMerchantDashboard(): Promise<MerchantDashboard> {
  const value = await request("/api/v1/merchants/me/dashboard");
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["serverTime"]) ||
    (value["shop"] !== null && !isRecord(value["shop"])) ||
    !isRecord(value["today"]) ||
    !isRecord(value["orders"]) ||
    (value["earnings"] !== null && !isRecord(value["earnings"]))
  ) {
    throw new MerchantApiError("Beez returned an incomplete dashboard summary.");
  }
  const today = value["today"];
  const orders = value["orders"];
  const earnings = value["earnings"];
  const paidOrdersToday = parseNonNegativeInteger(today["paidOrdersToday"]);
  const paidMerchandiseKesToday = parseNonNegativeInteger(today["paidMerchandiseKesToday"]);
  const preparingCount = parseNonNegativeInteger(orders["preparingCount"]);
  const readyCount = parseNonNegativeInteger(orders["readyCount"]);
  const paidOrdersThisMonth = parseNonNegativeInteger(orders["paidOrdersThisMonth"]);
  const paidMerchandiseKesThisMonth = parseNonNegativeInteger(
    orders["paidMerchandiseKesThisMonth"],
  );
  const productCount = parseNonNegativeInteger(value["productCount"]);
  const inStockProductCount = parseNonNegativeInteger(value["inStockProductCount"]);
  const parsedEarnings =
    earnings === null
      ? null
      : {
          availableKes: parseNonNegativeInteger(earnings["availableKes"]),
          deliveredOrders: parseNonNegativeInteger(earnings["deliveredOrders"]),
          commissionPercent: parseNonNegativeInteger(earnings["commissionPercent"]),
        };
  return {
    serverTime: value["serverTime"],
    shop: value["shop"] === null ? null : parseShop(value["shop"]),
    today: { paidOrdersToday, paidMerchandiseKesToday },
    orders: { preparingCount, readyCount, paidOrdersThisMonth, paidMerchandiseKesThisMonth },
    earnings: parsedEarnings,
    productCount,
    inStockProductCount,
  };
}

export async function saveMerchantShop(input: MerchantShopInput) {
  return parseShop(
    await request("/api/v1/merchants/me/shop", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export async function saveMerchantAvailability(input: MerchantAvailabilityInput) {
  return parseShop(
    await request("/api/v1/merchants/me/shop/availability", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function getMerchantProducts(): Promise<MerchantProduct[]> {
  const value = await request("/api/v1/merchants/me/products");
  if (!Array.isArray(value)) throw new MerchantApiError("Beez returned an invalid product list.");
  return value.map(parseProduct);
}

export async function createMerchantProduct(input: MerchantProductInput) {
  return parseProduct(
    await request("/api/v1/merchants/me/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function createMerchantProducts(inputs: MerchantProductInput[]) {
  const value = await request("/api/v1/merchants/me/products/batch", {
    method: "POST",
    body: JSON.stringify({ products: inputs }),
  });
  if (!Array.isArray(value)) throw new MerchantApiError("Beez returned an invalid product list.");
  return value.map(parseProduct);
}

export async function extractMerchantVoiceProducts(
  audio: Blob,
  language: "en" | "sw",
): Promise<VoiceProductExtraction> {
  const token = getAccessToken();
  if (!token)
    throw new MerchantApiError("Your sign-in session expired. Please sign in again.", 401);
  const form = new FormData();
  form.append("audio", audio, `merchant-voice-note.${audio.type.includes("mp4") ? "mp4" : "webm"}`);
  form.append("language", language);
  let response: Response;
  try {
    response = await fetch("/api/v1/merchants/me/voice-products", {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      body: form,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new MerchantApiError(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      isRecord(payload) && typeof payload["message"] === "string"
        ? payload["message"]
        : "Voice products could not be prepared. Please try again or enter them manually.";
    throw new MerchantApiError(message, response.status);
  }
  const value: unknown = await response.json().catch(() => null);
  if (
    !isRecord(value) ||
    typeof value["transcript"] !== "string" ||
    !Array.isArray(value["products"]) ||
    !Array.isArray(value["unparsedPhrases"])
  ) {
    throw new MerchantApiError("Beez returned an invalid voice product draft.");
  }
  const products = value["products"].map(parseVoiceProductDraft);
  const unparsedPhrases = value["unparsedPhrases"];
  if (!unparsedPhrases.every((phrase) => typeof phrase === "string")) {
    throw new MerchantApiError("Beez returned invalid product notes.");
  }
  return {
    transcript: value["transcript"],
    products,
    unparsedPhrases,
  };
}

export async function updateMerchantProduct(id: string, input: MerchantProductInput) {
  return parseProduct(
    await request(`/api/v1/merchants/me/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function archiveMerchantProduct(id: string) {
  await request(`/api/v1/merchants/me/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function request(
  path: string,
  options: { method?: string; body?: string } = {},
): Promise<unknown> {
  const token = getAccessToken();
  if (!token)
    throw new MerchantApiError("Your sign-in session expired. Please sign in again.", 401);
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new MerchantApiError(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      isRecord(payload) && typeof payload["message"] === "string"
        ? payload["message"]
        : "Your shop information could not be saved. Please try again.";
    throw new MerchantApiError(message, response.status);
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new MerchantApiError("Beez returned an unreadable response.");
  }
}

function parseShop(value: unknown): MerchantShop {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["id"]) ||
    !isNonEmptyString(value["slug"]) ||
    !isNonEmptyString(value["businessName"]) ||
    !isNonEmptyString(value["category"]) ||
    !isNonEmptyString(value["zoneId"]) ||
    !isNonEmptyString(value["zoneName"]) ||
    !isNonEmptyString(value["locationText"]) ||
    !isNonEmptyString(value["status"]) ||
    typeof value["isOpen"] !== "boolean" ||
    !isRecord(value["openingHours"]) ||
    typeof value["lat"] !== "number" ||
    !Number.isFinite(value["lat"]) ||
    typeof value["lng"] !== "number" ||
    !Number.isFinite(value["lng"]) ||
    (typeof value["payoutPhone"] !== "string" && value["payoutPhone"] !== null)
  ) {
    throw new MerchantApiError("Beez returned incomplete shop information.");
  }
  return {
    id: value["id"],
    slug: value["slug"],
    businessName: value["businessName"],
    category: value["category"],
    zoneId: value["zoneId"],
    zoneName: value["zoneName"],
    locationText: value["locationText"],
    status: value["status"],
    isOpen: value["isOpen"],
    openingHours: parseOpeningHours(value["openingHours"]),
    lat: value["lat"],
    lng: value["lng"],
    payoutPhone: value["payoutPhone"],
  };
}

function parseOpeningHours(value: Record<string, unknown>): Record<string, BusinessHours> {
  const parsed: Record<string, BusinessHours> = {};
  for (const [day, hours] of Object.entries(value)) {
    if (
      !isRecord(hours) ||
      typeof hours["open"] !== "boolean" ||
      (typeof hours["opensAt"] !== "string" && hours["opensAt"] !== null) ||
      (typeof hours["closesAt"] !== "string" && hours["closesAt"] !== null)
    ) {
      throw new MerchantApiError("Beez returned invalid shop opening hours.");
    }
    parsed[day] = {
      open: hours["open"],
      opensAt: hours["opensAt"],
      closesAt: hours["closesAt"],
    };
  }
  return parsed;
}

function parseProduct(value: unknown): MerchantProduct {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["id"]) ||
    !isNonEmptyString(value["name"]) ||
    (typeof value["unit"] !== "string" && value["unit"] !== null) ||
    typeof value["priceKes"] !== "number" ||
    !Number.isSafeInteger(value["priceKes"]) ||
    value["priceKes"] < 0 ||
    typeof value["inStock"] !== "boolean"
  ) {
    throw new MerchantApiError("Beez returned invalid product information.");
  }
  return {
    id: value["id"],
    name: value["name"],
    unit: value["unit"],
    priceKes: value["priceKes"],
    inStock: value["inStock"],
  };
}

function parseVoiceProductDraft(value: unknown): VoiceProductDraft {
  if (
    !isRecord(value) ||
    typeof value["name"] !== "string" ||
    (typeof value["unit"] !== "string" && value["unit"] !== null) ||
    typeof value["priceKes"] !== "number" ||
    !Number.isSafeInteger(value["priceKes"]) ||
    typeof value["confidence"] !== "number" ||
    !Number.isFinite(value["confidence"]) ||
    typeof value["sourcePhrase"] !== "string"
  ) {
    throw new MerchantApiError("Beez returned an invalid voice product draft.");
  }
  return {
    name: value["name"],
    unit: value["unit"],
    priceKes: value["priceKes"],
    confidence: value["confidence"],
    sourcePhrase: value["sourcePhrase"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseNonNegativeInteger(value: unknown): number {
  if (!isNonNegativeInteger(value)) {
    throw new MerchantApiError("Beez returned invalid dashboard totals.");
  }
  return value;
}
