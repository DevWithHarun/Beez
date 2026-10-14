export type Zone = {
  id: string;
  name: string;
};

export type PublicShopSummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  zoneId: string;
  zoneName: string;
  locationText: string | null;
  isOpen: boolean;
};

export type PublicProduct = {
  id: string;
  name: string;
  unit: string | null;
  priceKes: number;
  inStock: boolean;
};

export type PublicShop = PublicShopSummary & {
  products: PublicProduct[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type BasketLineInput = {
  productId: string;
  qty: number;
};

export type BasketCreateInput = {
  zoneId: string;
  lines: BasketLineInput[];
  customer: { name: string; phone: string };
  delivery: { lat: number; lng: number; landmark: string };
};

export type GuestBasket = {
  basketNo: string;
  trackingToken: string;
  itemsTotalKes: number;
  deliveryFeeKes: number;
  totalKes: number;
  status: string;
  expiresAt: string;
  vendors: Array<{
    merchantId: string;
    name: string;
    slug: string;
    subtotalKes: number;
    status: string;
    refundStatus: "PENDING" | "CONFIRMED" | "FAILED" | null;
  }>;
  lines: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPriceKes: number;
    lineTotalKes: number;
    merchantId: string;
    shopName: string;
    shopSlug: string;
  }>;
};

export type BasketPaymentStart = {
  paymentId: string;
  status: string;
  message: string;
  deliveryCode: string | null;
};

export class DiscoverApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DiscoverApiError";
  }
}

export async function getZones(cursor?: string): Promise<CursorPage<Zone>> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const query = params.size ? `?${params.toString()}` : "";
  return request(`/api/v1/public/zones${query}`).then((body) =>
    parseCursorPage(body, parseZone, "zones"),
  );
}

export function getShops({
  zone,
  category,
  query,
  cursor,
}: {
  zone: string;
  category?: string;
  query?: string;
  cursor?: string;
}): Promise<CursorPage<PublicShopSummary>> {
  const params = new URLSearchParams({ zone });
  if (category) params.set("category", category);
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);

  return request(`/api/v1/public/shops?${params.toString()}`).then((body) =>
    parseCursorPage(body, parseShopSummary, "shops"),
  );
}

export async function getShop(slug: string): Promise<PublicShop> {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug)) {
    throw new DiscoverApiError("This shop link is not valid.", 400);
  }
  const body = await request(`/api/v1/public/m/${encodeURIComponent(slug)}`);
  return parseShop(body);
}

export async function createBasket(
  input: BasketCreateInput,
  idempotencyKey = createGuestIdempotencyKey(),
): Promise<GuestBasket> {
  return parseBasket(
    await request("/api/v1/public/baskets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    }),
  );
}

export function createGuestIdempotencyKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getBasket(trackingToken: string): Promise<GuestBasket> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(trackingToken)) {
    throw new DiscoverApiError("This tracking link is not valid.", 400);
  }
  return parseBasket(await request(`/api/v1/public/baskets/${encodeURIComponent(trackingToken)}`));
}

export async function startBasketPayment(trackingToken: string): Promise<BasketPaymentStart> {
  const value = await request(`/api/v1/public/baskets/${encodeURIComponent(trackingToken)}/pay`, {
    method: "POST",
  });
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["paymentId"]) ||
    !isNonEmptyString(value["status"]) ||
    !isNonEmptyString(value["message"]) ||
    (typeof value["deliveryCode"] !== "string" && value["deliveryCode"] !== null) ||
    (typeof value["deliveryCode"] === "string" && !/^\d{6}$/.test(value["deliveryCode"]))
  ) {
    throw new DiscoverApiError("Beez returned an incomplete payment response.");
  }
  return {
    paymentId: value["paymentId"],
    status: value["status"],
    message: value["message"],
    deliveryCode: value["deliveryCode"],
  };
}

async function request(
  path: string,
  options: Pick<RequestInit, "method" | "headers" | "body"> = { method: "GET" },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new DiscoverApiError(
      "We can’t reach Beez right now. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      isRecord(payload) && typeof payload["message"] === "string"
        ? payload["message"]
        : response.status === 404
          ? path.includes("/public/m/")
            ? "This shop could not be found."
            : "Beez discovery is not available yet. Please try again later."
          : "Discovery is temporarily unavailable. Please try again.";
    throw new DiscoverApiError(message, response.status);
  }

  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new DiscoverApiError("Beez returned an unreadable response. Please try again.");
  }
}

function parseBasket(value: unknown): GuestBasket {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["basketNo"]) ||
    !isNonEmptyString(value["trackingToken"]) ||
    !isNonEmptyString(value["status"]) ||
    !isNonEmptyString(value["expiresAt"]) ||
    !isSafeKes(value["itemsTotalKes"]) ||
    !isSafeKes(value["deliveryFeeKes"]) ||
    !isSafeKes(value["totalKes"]) ||
    !Array.isArray(value["vendors"]) ||
    !Array.isArray(value["lines"])
  ) {
    throw new DiscoverApiError("Beez returned an incomplete basket quote.");
  }

  return {
    basketNo: value["basketNo"],
    trackingToken: value["trackingToken"],
    status: value["status"],
    expiresAt: value["expiresAt"],
    itemsTotalKes: value["itemsTotalKes"],
    deliveryFeeKes: value["deliveryFeeKes"],
    totalKes: value["totalKes"],
    vendors: value["vendors"].map(parseBasketVendor),
    lines: value["lines"].map(parseBasketLine),
  };
}

function parseBasketVendor(value: unknown): GuestBasket["vendors"][number] {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["merchantId"]) ||
    !isNonEmptyString(value["name"]) ||
    !isNonEmptyString(value["slug"]) ||
    !isSafeKes(value["subtotalKes"]) ||
    !isNonEmptyString(value["status"]) ||
    (value["refundStatus"] !== null &&
      value["refundStatus"] !== "PENDING" &&
      value["refundStatus"] !== "CONFIRMED" &&
      value["refundStatus"] !== "FAILED")
  ) {
    throw new DiscoverApiError("Beez returned incomplete shop totals.");
  }
  return {
    merchantId: value["merchantId"],
    name: value["name"],
    slug: value["slug"],
    subtotalKes: value["subtotalKes"],
    status: value["status"],
    refundStatus: value["refundStatus"],
  };
}

function parseBasketLine(value: unknown): GuestBasket["lines"][number] {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["productId"]) ||
    !isNonEmptyString(value["name"]) ||
    !isPositiveSafeInteger(value["qty"]) ||
    !isSafeKes(value["unitPriceKes"]) ||
    !isSafeKes(value["lineTotalKes"]) ||
    !isNonEmptyString(value["merchantId"]) ||
    !isNonEmptyString(value["shopName"]) ||
    !isNonEmptyString(value["shopSlug"])
  ) {
    throw new DiscoverApiError("Beez returned an invalid basket item.");
  }
  return {
    productId: value["productId"],
    name: value["name"],
    qty: value["qty"],
    unitPriceKes: value["unitPriceKes"],
    lineTotalKes: value["lineTotalKes"],
    merchantId: value["merchantId"],
    shopName: value["shopName"],
    shopSlug: value["shopSlug"],
  };
}

function isSafeKes(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseCursorPage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
  label: string,
): CursorPage<T> {
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    throw new DiscoverApiError(`Beez returned an unexpected ${label} response.`);
  }

  const nextCursor = value["nextCursor"];
  if (nextCursor !== null && typeof nextCursor !== "string") {
    throw new DiscoverApiError(`Beez returned an invalid ${label} page.`);
  }

  return { items: value["items"].map(parseItem), nextCursor };
}

function parseZone(value: unknown): Zone {
  if (!isRecord(value) || !isNonEmptyString(value["id"]) || !isNonEmptyString(value["name"])) {
    throw new DiscoverApiError("Beez returned an incomplete service area.");
  }
  return { id: value["id"], name: value["name"] };
}

function parseShopSummary(value: unknown): PublicShopSummary {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value["id"]) ||
    !isNonEmptyString(value["slug"]) ||
    !isNonEmptyString(value["name"]) ||
    !isNonEmptyString(value["category"]) ||
    !isNonEmptyString(value["zoneId"]) ||
    !isNonEmptyString(value["zoneName"]) ||
    (typeof value["locationText"] !== "string" && value["locationText"] !== null) ||
    typeof value["isOpen"] !== "boolean"
  ) {
    throw new DiscoverApiError("Beez returned incomplete shop information.");
  }

  return {
    id: value["id"],
    slug: value["slug"],
    name: value["name"],
    category: value["category"],
    zoneId: value["zoneId"],
    zoneName: value["zoneName"],
    locationText: value["locationText"],
    isOpen: value["isOpen"],
  };
}

function parseShop(value: unknown): PublicShop {
  if (!isRecord(value) || !Array.isArray(value["products"])) {
    throw new DiscoverApiError("Beez returned incomplete shop information.");
  }
  return {
    ...parseShopSummary(value),
    products: value["products"].map(parseProduct),
  };
}

function parseProduct(value: unknown): PublicProduct {
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
    throw new DiscoverApiError("Beez returned an invalid product.");
  }
  return {
    id: value["id"],
    name: value["name"],
    unit: value["unit"],
    priceKes: value["priceKes"],
    inStock: value["inStock"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
