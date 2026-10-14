# Notification module

**Owns:** transactional outbox, templates/locales, channel dispatch status,
retry attempts, sent/ack times and push-subscription delivery coordination.
Business services write an outbox row in the same database transaction as the
business event; a worker delivers only after commit. A failed send is retried
with backoff up to three attempts and remains observable.

Channel boundary: SMS through BlessedTexts with VasPro failover, Web Push via
VAPID, and future channels behind `NotificationChannel`; Auth's `SmsSender` can be a
narrow consumer-facing port. Provider credentials live only in config/secrets.

Required event mapping:

| Event | Recipient/channel | Fallback |
| --- | --- | --- |
| Basket paid | Each shop: Web Push | SMS if not acknowledged within 60s |
| Basket paid | Customer: SMS receipt, tracking link, delivery code | None |
| Delivery offerable | Nearby riders: Push and Jobs list | Widen search after 2m |
| Assignment/pickup/on-way, late/rejected | Customer Track; SMS for key changes | None |
| Delivered | Customer, shops and rider dashboards/Track | None |
| Approval/rejection | Affected person: SMS + Push | None |
| Withdrawal requested/paid/rejected | User SMS/dashboard; admin alert for request | None |
| New device/number change/refresh replay | User and admin SMS | None |

Templates are short and localized in Swahili/English; never include full phone
numbers or secrets except the one-time code itself. Quiet hours do not suppress
urgent order alerts. Remove push subscription at logout or account switch.
Merchant paid-order SMS is now queued transactionally with the verified payment
settlement in `merchant_order_alerts`. The scheduled worker sends an SMS through
the configured primary/fallback gateway, retries transient delivery failures
with backoff for up to three attempts, recovers stale claims, and records a
terminal delivery status without storing provider response bodies. Production
and sandbox profiles require their existing SMS gateway credentials. The web
service worker can display a generic paid-order notification, but subscription
storage, VAPID delivery, acknowledgement tracking, and the 60-second push-to-SMS
fallback are not wired yet. They must not be considered operational until the
VAPID keys are configured and an end-to-end delivery test succeeds. Shop media
upload likewise remains unavailable until a private object-storage adapter,
bucket policy, and credentials are configured.
