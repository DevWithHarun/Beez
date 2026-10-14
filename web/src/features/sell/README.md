# Sell tab — merchant workspace

**Actor:** one signed-in merchant phone/role; each merchant sees only their own
shop and vendor-order part. If a merchant opens Ride, explain that a separate
phone/role is required. Signed-out users see an explanation and phone
sign-in/onboarding entry, not an empty dashboard.

The workspace groups `onboarding/`, `home/`, `orders/`, `products/`, `shop/`
and `earnings/`. Onboarding collects shop name/category/zone/location, payout
phone and optional intro video; merchant must become ACTIVE/approved before
public catalogue exposure. Product entry is voice-first but typing is always
available. Voice candidates remain drafts until merchant review/confirmation.

Orders show only this shop's vendor-order part, with ready deadline and own
status actions (`READY` or `REJECTED`); never expose the customer's delivery
code. New paid order alerts use push, then SMS after 60 seconds without
acknowledgment. Shop earnings are credited only when the whole basket delivers.
Earnings show available/held/history from Wallet, and withdrawal requests use
the shared Wallet sheet/API.

Dependencies: Auth, Catalogue, Voice, Basket vendor-order services,
Notification acknowledgments, Wallet. All reads/writes are server-scoped to
the merchant ID. Screen badges reflect server queues. These are target
boundaries; merchant product flows are not implemented.
