# Merchant orders

**Owns:** merchant-scoped order queries, summary data and guarded
`PAID → READY` and `PAID → REJECTED` transitions. Orders awaiting payment are
never visible to merchants. Query ownership is resolved through the
authenticated merchant's `user_id`; customer contact and delivery landmark
are private order data and responses use `Cache-Control: no-store`.

`GET /api/v1/merchants/me/orders/summary` returns preparing/ready counts and
the current month's confirmed paid merchandise subtotal. Delivery fees are
excluded. `GET /api/v1/merchants/me/orders` supports status filters and an
opaque keyset cursor. `GET /api/v1/merchants/me/orders/{id}` returns a
merchant-owned order. `PATCH /api/v1/merchants/me/orders/{id}/ready` is
idempotent when already ready; otherwise it only permits paid orders, updates
the basket to `IN_PROGRESS`, and records the acting merchant and state change
in `vendor_order_events`. `POST /api/v1/merchants/me/orders/{id}/reject`
requires a reason and only works while the order is still `PAID`. It creates a
pending refund request for that shop subtotal; it does not call M-Pesa or
cancel other vendors' orders. The merchant order response includes refund
status and assigned rider details when available.

Rider assignment, ordered pickups and customer-code delivery confirmation are
handled by Dispatch. Merchant earnings are credited by Wallet only after
verified delivery. Refund execution remains external and is recorded later by
Beez operations.
