# Catalogue module

**Owns:** market/service zones, merchant public profiles and shop slugs,
products, stock flags, categories, media references, and public discovery.
Core records are `zones`, `merchants`, and `products`; user identity remains
Auth-owned. Merchant onboarding/status approval is surfaced by this module
but the approval decision is performed through Admin's service workflow.

A public shop requires an ACTIVE, approved merchant. Product listing excludes
soft-deleted products. Product price is a nonnegative integer KES; media fields
are object-storage keys, never public bucket credentials. Shop links use
`/m/{slug}`. Discovery filters by active zone/category/search query. A merchant
may edit only their own profile, media and products.

## Public and merchant API

Implemented routes include `GET /api/v1/public/zones`,
`GET /api/v1/public/shops`, `GET /api/v1/public/m/{slug}` and
merchant-owned shop/product read, create, update and archive routes under
`/api/v1/merchants/me/**`. Public responses are no-store; merchant writes
require the merchant role and service-level ownership checks. New shops start
in `PENDING_REVIEW`; the authenticated shop response includes coordinates and
the merchant's own payout phone so shop settings can be edited without losing
saved location details. `PATCH /api/v1/merchants/me/shop/availability` persists
the accepting-orders flag and seven-day local opening-hours schedule. The
public discovery and shop responses expose the open flag, and basket creation
rejects a closed merchant at the server boundary. Existing ACTIVE merchants
remain open when the availability migration is applied; new shops default
closed until an owner opens them. `GET /api/v1/merchants/me/dashboard` returns
the owner-scoped shop, Nairobi-day order totals, order summary, earnings and
catalogue counts in a single no-store response. Admin approval and media upload
are not implemented.

Basket currently reads product/merchant rows directly through JDBC while
creating transactional snapshots. Extract a shared availability/price service
before moving module persistence boundaries further. Catalogue does not
calculate basket totals or initiate payments.

Zones persist as inactive by default and there is no provisioning/admin route
or seed data. A zone must be activated operationally before public discovery
and checkout are available. Checkout validates delivery points against the
configured centre/radius, but the authoritative zone-boundary model,
ownership and rollout remain open decisions.
