# Basket and orders module

**Owns:** customer baskets, one vendor-order part per merchant, immutable item
snapshots, pricing, delivery-fee quotation, cancellation/expiry and order state
transitions. Core data is `baskets`, `vendor_orders` and `order_items`.
Customers remain guests; the basket gets a high-entropy tracking capability
managed according to Auth's capability-token policy.

## Create and pay boundary

`POST /api/v1/public/baskets` accepts zone, product IDs/quantities, customer
contact, and delivery location/landmark. The module re-reads product prices
from Catalogue; all client prices are ignored. All shops must be in the same
active zone. Server calculates and stores goods total, per-shop subtotals,
delivery fee and total once. The approved sandbox pilot values are KES 100
base, KES 40 per additional shop, 3 km free and KES 20 per additional km. They
are configured through `DELIVERY_BASE_FEE_KES`,
`DELIVERY_EXTRA_SHOP_FEE_KES`, `DELIVERY_FREE_DISTANCE_KM`, and
`DELIVERY_PER_KM_FEE_KES`. Current distance is the shortest straight-line
route between shop pins and the delivery pin; replace it with a route provider
before using it as a production quote.

One basket maps to one vendor order per shop, one STK Push payment and, when
at least one shop order is ready, one delivery with an ordered stop for every
ready shop order. A six-digit customer delivery code is created for the basket.
Shops outside the zone cannot be combined.

Implemented routes create and track a guest basket. Creation locks and
re-reads available product rows, validates the active zone/radius, stores
snapshots, computes the quote on the server, requires an idempotency key,
hashes the tracking capability, and applies IP/unpaid-phone limits. Basket
records expire for display after 15 minutes.
Checkout requires `BASKET_TOKEN_SECRET` to be configured as a stable,
high-entropy secret of at least 32 characters; without it the basket endpoint
returns `503 checkout_unavailable`.

Daraja sandbox initiation and verified callback settlement are implemented.
A payment provider result is queried server-side before a basket/vendor order
can be marked paid. A merchant may reject a shop order only while it is still
`PAID`; rejection creates a pending refund request for that shop subtotal and
does not cancel other shops or start an automatic provider refund. The public
tracking response exposes each shop's state and refund status.

Dispatch queues a basket after every non-rejected shop order is ready. An
approved, online rider claims the job, confirms pickups in order, then enters
the customer code. Verified delivery completes eligible shop orders and the
basket. Wallet credits each merchant's 95% share and Beez's 5% commission only
after that verification. External M-Pesa refund execution, customer replacement
choice, automatic reconciliation, rider earnings/payouts and Admin UI remain
unimplemented. Guest baskets do not identify a signed-in customer.
