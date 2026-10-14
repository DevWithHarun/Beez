# Web Push

Use browser permission only after explaining notification value. Subscribe
through the authenticated `/push/subscribe` endpoint and store subscription
server-side for the signed-in user. Unsubscribe at logout or account switch;
handle browser-expired subscriptions as removable provider errors.

Push is an attention channel, not the system of record. Merchant paid-order
alerts use Push then SMS if unacknowledged for 60 seconds. Rider offers appear
in Jobs and notify nearby eligible riders. Notification/outbox status and
acknowledgement are server-owned. Use VAPID credentials from secrets
configuration; never cache subscription/private notification payloads or
include full phone numbers.
