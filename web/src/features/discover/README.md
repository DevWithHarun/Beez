# Discover tab

**Actor:** guest/customer. Browsing and basket creation do not require an
account. Shops are shareable at `/m/{slug}`.

**Owns the experience:** active-zone selection, public shop/category/search
results, shop product pages, same-zone cart contents, and guest basket
creation. The cart may include products from multiple shops in one selected
zone; the server re-reads prices and computes the quote.

**Public API:** `GET /api/v1/public/zones`,
`GET /api/v1/public/shops?zone=&category=&q=`,
`GET /api/v1/public/m/{slug}`, `POST /api/v1/public/baskets`,
`GET /api/v1/public/baskets/{trackingToken}`, and
`POST /api/v1/public/baskets/{trackingToken}/pay`. Public responses are
no-store. Basket creation requires an idempotency key and returns server
snapshots, totals and a high-entropy tracking capability. The database stores
only its hash and an idempotency fingerprint.
Payment-start returns the customer’s six-digit delivery code with the payment
request status. The Track page shows each shop’s fulfilment and pending,
confirmed or failed refund status.

**Delivery pricing:** backend-owned pilot settings default to KES 100 base,
KES 40 for each additional shop, first 3 km free, then KES 20 per additional
km. Override with the documented `DELIVERY_*` environment variables. The
browser never calculates the payable total.

The read contract uses cursor pages `{ items, nextCursor }`; zones expose `id`
and `name`; shop summaries expose `id`, `slug`, `name`, `category`, `zoneId`,
`zoneName`, and nullable `locationText`; shop pages add products with `id`,
`name`, nullable `unit`, integer `priceKes`, and `inStock`.

The backend catalogue, merchant shop/product APIs, guest basket persistence,
merchant workspace and a session-scoped Track page are implemented. Store
approval and active service-area provisioning remain operational prerequisites:
new shops start in `PENDING_REVIEW`, and no zones are seeded by these
migrations. Delivery codes are retained in session storage for the current
browser tab and removed after completed delivery; the customer should keep the
code private and share it only with the rider at drop-off.

Daraja STK Push initiation and verified payment callback reconciliation are
implemented, but require correctly configured provider credentials and a
public callback URL. Payment-start only prompts for M-Pesa payment; the basket
is not treated as paid until Beez verifies the provider callback.
The public anonymous basket endpoint also cannot identify a signed-in merchant
to prevent ordering from their own shop.
