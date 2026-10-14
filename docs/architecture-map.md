# Beez architecture map

This map turns
[`production-architecture.html`](./production-architecture.html) (v1.0) into
the ownership and dependency guide for this repository. The HTML architecture
is the source for product behavior, data flows and security constraints.
Module READMEs explain how each package applies it. Where implementation is
not yet present, these are design contracts—not claims of running behavior.

## Product surfaces and end-to-end journey

| Surface | Actor | Owns | Main interactions |
| --- | --- | --- | --- |
| `/app` entry | All roles | Role choice and sign-in/onboarding entry | Customer guest path; merchant/rider Auth |
| Discover | Guest/customer | Zones, search, shop pages, multi-shop basket and checkout | Catalogue, basket, payment |
| Track | Guest/customer | Session-scoped capability-token access to the latest guest basket | Basket/order status, delivery |
| Sell | Merchant | Shop onboarding, products/media, vendor-order part, earnings/withdrawal | Auth, catalogue, voice, basket, wallet |
| Ride | Approved rider | Availability, offered jobs, ordered stops, delivery confirmation, earnings | Auth, dispatch, wallet |
| `/admin` | Admin | Approvals, operations, payments, withdrawals, refunds, users and audit | All modules through service interfaces |

The target journey is:

1. A customer opens a shop link (`/m/{slug}`) or browses a zone, then adds
   products from one or more shops in that zone.
2. The server snapshots product names/prices, validates stock, calculates
   vendor subtotals, delivery fee and total, and creates a basket with one
   vendor order per shop. It returns a high-entropy tracking capability.
3. Checkout initiates one M-Pesa STK Push for the server-calculated total. No
   merchant is notified until the callback is verified against Daraja and
   amount/reference checks pass.
4. One database transaction marks payment/basket/vendor orders paid, creates
   one delivery and its shop stops, records the customer-funds ledger entries,
   and writes notification-outbox rows. A worker sends messages after commit.
5. Each merchant sees only their vendor-order part and marks it ready or
   rejects it. Once every active part is ready, dispatch offers one multi-stop
   job to eligible riders. First acceptance wins atomically.
6. The rider confirms each pickup and enters the customer's four-digit
   delivery code at drop-off. A successful delivery completes the basket and
   atomically allocates the customer funds to shop, rider and Beez ledger
   accounts.
7. Merchant/rider withdrawal requests reserve funds (`AVAILABLE` to `HELD`).
   In phase 1 an admin pays manually in M-Pesa, records the reference and
   audit event, then the ledger records payout; rejection returns the hold.

The four tabs update from server state/events. They never invoke another role's
UI or mutate another module's data directly.

## Backend module ownership and dependencies

One deployable Spring Boot 3 application is a modular monolith. A module owns
its domain, API, services, persistence and state transitions. Consumers call
public service interfaces; modules do not query another module's tables or
repositories. Provider-facing SPIs are owned by the business module, while
concrete integrations live under `adapters/`.

| Package | Owns | Calls / receives from | Key records |
| --- | --- | --- | --- |
| `auth` | Users, OTP challenges, refresh families, roles, admin MFA, push subscriptions | Notifications for SMS; Redis for limits | `users`, `otp_challenges`, `refresh_tokens`, `auth_events`, `admin_backup_codes`, `push_subscriptions` |
| `catalogue` | Merchants, public shop pages, products, stock, zones and media references | Voice and object-storage services | `merchants`, `products`, `zones` |
| `voice` | In-memory audio processing, extraction drafts, validation and merchant confirmation | OpenAI `SpeechToText`/`ProductExtractor` adapters, Catalogue | `merchant_voice_usage` hourly account limits |
| `basket` | Basket, vendor-order parts, item snapshots, pricing, delivery fee and state machine | Catalogue, Payment, Dispatch, Wallet by service interfaces | `baskets`, `vendor_orders`, `order_items` |
| `payment` | Payment attempts, raw callback intake, verification, reconciliation and refund records | `PaymentProvider`; Basket and Wallet services | `payments`, `payment_callbacks`, `refunds` |
| `dispatch` | Rider eligibility/availability, location, deliveries, stops, offers, delivery code and tracking | Basket/order and notification services | `riders`, `deliveries`, `delivery_stops` |
| `wallet` | Append-only ledger, balances derived from entries, withdrawal lifecycle and settlement | Payment, Admin, M-Pesa later | `ledger_accounts`, `ledger_txns`, `ledger_entries`, `withdrawals` |
| `notification` | Transactional outbox, templates, channel delivery, acknowledgements/retries | Web Push, SMS and voice channel adapters | `notifications` |
| `admin` | Approval queues, operational views, audited manual actions, metrics | Every module through service interfaces | `audit_log` plus service query models |
| `common` | Cross-cutting errors, money, clock, IDs, masking, idempotency and rate-limit primitives | No domain ownership; depend on abstractions only | Shared value types/utilities |
| `config` | Security, CORS, Jackson, validation, scheduling and typed settings | Wires services and adapters | Configuration only |
| `adapters` | Daraja, SMS gateway, Web Push, speech, LLM and S3-compatible implementations | Implements business-owned SPIs | No business-table ownership |

**Dependency rule:** business modules expose service interfaces; adapters
implement SPIs; configuration composes them. Cross-module table joins,
repository injection, and direct controller-to-controller calls are forbidden.
Admin reads and acts through these same services and never has direct table
access.

## Data model and ownership

IDs are UUIDs unless the spec explicitly selects a sequence; timestamps are
UTC; money uses integer whole Kenyan shillings. PostgreSQL constraints are part
of correctness, not just ORM validation.

| Aggregate | Core relations | Invariants/notes |
| --- | --- | --- |
| Identity | `users` with merchant/rider profiles; OTP, refresh, auth events, backup codes, push subscriptions | A phone belongs to one non-admin role; admin uses email/password/MFA |
| Catalogue | `zones` → merchants → products | Active approved shops are public; deleted products are soft-deleted; product price is nonnegative |
| Basket | `baskets` → unique-per-shop `vendor_orders` → item snapshots | Same zone; price snapshot is server-owned; `total = item totals + delivery fee`; one order part per merchant |
| Payment | Basket → payment attempts and callback inbox | Unique provider checkout request and receipt; callbacks are stored, verified and processed idempotently |
| Delivery | One delivery per basket → one stop per vendor order; delivery references rider | Code is HMAC-stored; attempt count capped; rider location is time-bounded |
| Wallet | Owner/kind ledger account → ledger transaction → immutable entries | Credits positive/debits negative; every transaction sums to zero; balance is sum of entries; merchant gets 95% of merchandise and rider gets 95% of delivery fee after verified delivery |
| Withdrawal/refund | Request/refund references accounts, basket/order and ledger transactions | One open withdrawal per user; hold/payout/release are balanced ledger transactions; refunds are reversal entries |
| Operations | Outbox notification rows and append-only audit rows | Side effects send after commit; admin actions record actor, target and before/after |

The entity/table inventory and proposed PostgreSQL columns are in section 4 of
the HTML architecture. `V001`–`V007` files currently only preserve target
filenames/order; they are not schema and must be replaced by reviewed
migrations. The spec says all IDs are UUIDs, all times UTC, and money is integer
KES. It explicitly calls for a deferred ledger-balance constraint/transaction
invariant and a unique partial index for open withdrawals.

## State machines and cross-module contracts

The backend service layer—not the client—enforces state transitions and
ownership:

- Basket: `PENDING_PAYMENT → PAID → IN_PROGRESS → COMPLETED`; cancellation and
  expiry are terminal alternatives. Verified M-Pesa amount must match before
  `PAID`; correct delivery code completes it.
- Vendor order: `AWAITING_PAYMENT → PAID → READY → PICKED_UP → DELIVERED`;
  `PAID → REJECTED` or cancellation is allowed only under the order rules.
  Merchant actions are scoped to their own part.
- Delivery: `UNASSIGNED → ASSIGNED → COLLECTING → ON_THE_WAY → DELIVERED`;
  failure is handled explicitly. Rider acceptance is an atomic conditional
  write. Stops are picked up or skipped only when allowed by part status.
- Withdrawal: `REQUESTED → PROCESSING → PAID`, or `REJECTED`/`FAILED`; every
  terminal transition resolves the held funds and requires audit evidence.

The basket-total invariant is recalculated for partial rejections/refunds;
refund/ledger reversal and the related status change share one database
transaction. Repeated callbacks/commands must be idempotent.

## API rules and route ownership

REST/JSON is versioned at `/api/v1`. All errors have
`{error, message, details, requestId}`; lists use cursor pagination; money fields
use `*Kes` and contain integer KES; every mutation that can be retried accepts
`Idempotency-Key`. The route inventory and role assignments are in section 13
and `docs/api/openapi.yaml`; the latter is a design inventory, not yet generated
from a running backend.

| Route family | Module | Access |
| --- | --- | --- |
| `/public/zones`, `/public/shops`, `/public/m/{slug}`, `/public/baskets` | Catalogue/Basket | Guest, rate-limited |
| `/auth/**`, `/push/**` | Auth | OTP endpoints public; session endpoints use cookie/token rules |
| `/merchants/**`, `/products/**`, `/vendor-orders/**`, `/voice-products/**` | Catalogue/Voice/Basket | Merchant-owned records |
| `/riders/**`, `/deliveries/**` | Dispatch | Approved rider, ownership scoped |
| `/withdrawals/**`, `/earnings/**` | Wallet | Own merchant/rider account |
| `/admin/**` | Admin | Admin role, fresh MFA for sensitive actions, audit all mutations |
| `/webhooks/mpesa/**`, `/webhooks/sms/**` | Payment/Notification | Machine callback; HTTPS/secret path and provider verification |

## Authentication and access-control contract

- Merchant/rider: normalized `+254` mobile, six-digit `SecureRandom` OTP,
  HMAC keyed by secret and challenge ID, five-minute expiry, five attempts,
  single use, resend after 60 seconds, generic request response and voice-call
  fallback. User starts `ONBOARDING` (merchant) or `PENDING_APPROVAL` (rider).
- Access JWT: 15 minutes, memory only, claims include role, user/merchant/rider
  ID, token version, issuer/audience and token ID. Reject `alg:none`; signing
  algorithm/key rotation is an implementation decision in the spec.
- Refresh: opaque 256-bit token, HttpOnly/Secure/SameSite=Lax cookie, 60-day
  sliding/180-day hard cap, SHA-256 hash server side, rotate each use; replay
  revokes the token family. Cookie endpoints require `X-Beez-Client: pwa`,
  Origin checking and `no-store`. Client refresh is single-flight.
- Customer: no account. A >=128-bit random basket capability is shown/sent
  once, stored only as SHA-256 hash server-side, scoped to that basket. The
  current pending-basket implementation expires after 15 minutes; the final
  post-payment retention policy remains to be implemented. Never cache
  responses or leak capability in referrers.
- Admin: no public sign-up; email, >=12-character password hash, TOTP and
  single-use backup codes. Lock after five failures. Sensitive actions require
  recent MFA and append-only audit.
- Enforce role gates and ownership-scoped lookups (`404`, not cross-account
  `403`); apply status/state checks in services. OTP, basket, callback,
  tracking, SMS-spend and delivery-code limits are intended to use shared
  Redis-backed limits. Basket creation currently uses an hourly PostgreSQL
  rate-limit table plus an unpaid-phone cap.

The HTML spec sections 10 and 17 contain exact proposed tables, limits and
threat controls. Product/privacy/legal review is required before production.

## Voice, notifications and admin

**Voice:** browser `MediaRecorder` audio, max 60 seconds and English/Swahili
language choice; authenticated 10 MB upload, capped at 10 requests and 50 MB
per merchant per hour. OpenAI transcription and strict-schema product
extraction use environment-provided credentials; audio and transcript are not
persisted by Beez. The merchant reviews, edits, or removes drafts before
explicit confirmation publishes them through an atomic Catalogue batch
endpoint. Manual product entry is always available. Measure correction and
confirmation rates against a consented Swahili/English/mixed-language test
set before changing models.

**Notifications:** verified paid orders write merchant SMS outbox rows in the
payment transaction; the scheduled worker dispatches through the configured
SMS gateway, retries up to three times with backoff, and recovers stale claims.
Web Push, merchant acknowledgement tracking, customer receipts, rider offers,
and other lifecycle alerts are not yet implemented. Localized short en/sw
messages, masked phones/secrets, quiet hours except urgent order alerts.

**Admin:** separate `/admin` group/bundle and sign-in. Sections: Overview,
Approvals, Orders, Payments, Withdrawals, Ledger (read-only), Refunds, Users,
Metrics, Audit. Manual financial/security actions require recent MFA and an
audit record; high payouts require a second admin; ledger corrections are
reversals, never edits. Finance-only CSV exports are logged.

## Infrastructure, observability and quality gates

| Concern | v1 design |
| --- | --- |
| Local | Compose with PostgreSQL, Redis, MinIO; fake SMS and mocked M-Pesa |
| Staging | Every merge rehearsal with test data and provider sandboxes |
| Production | Container deployment with rolling health-checked releases, secrets manager, TLS/WAF/rate limits, CDN for static PWA |
| Data | PostgreSQL primary, encrypted/off-site backups and tested restore; Redis for shared limits/locks; private S3-compatible media |
| Observability | Structured JSON logs with request/basket/payment/withdrawal IDs; mask phones/redact secrets; Prometheus/Grafana, Sentry and uptime checks |
| Alerts | Availability, payment age/callback lag/orphans, ready/dispatch delay, ledger imbalance/reconciliation, auth/OTP abuse, voice quality and infrastructure pressure |
| Recovery | Quarterly restore test; pilot targets RPO <15 minutes and RTO <2 hours |

PR gates: backend/web build, unit/integration tests, PostgreSQL Testcontainers,
contract fixtures/sandboxes, dependency/secret scans and lint. Merge builds
images and stages/smoke-tests. Tagged release requires manual approval,
rolling deploy and rollback on health failure. Flyway changes must be
backward-compatible expand/migrate/contract.

Tests cover pricing, fee config, ledger zero-sum, state transitions, OTP/token
logic, phone normalization, voice validation, full PostgreSQL flows, callback
contracts, concurrency (rider acceptance/withdrawals), every role/ownership
boundary, replay/forged callbacks/rate limits/delivery-code brute force,
nightly money invariants, phone-viewport E2E and realistic rush/load.

## Security, privacy and regulatory boundary

The design assumes Kenya is the first market and does not replace legal or
provider review. Collect only phone, delivery location, consented merchant
voice/video, and rider identity evidence needed for the service. Show a plain
English/Swahili notice with audio at sign-in and checkout. Keep rider ID
documents private and visible only to admins responsible for approval; delete
after the approved retention period is defined. Support data-access/deletion
requests by anonymizing identity while retaining legally required financial
records.

Proposed retention from the spec: OTP/refresh rows seven days after expiry;
auth events 12 months; orders/ledger retained as required for accounting and
disputes, then personal fields anonymized. These periods and ID-photo deletion
period still need privacy/legal approval. Kenya Data Protection Act duties,
registration/notification, privacy notice and terms require current authority
and legal review. Holding customer funds and paying out may trigger financial
licensing; obtain financial-services counsel before wallet launch at scale.

Threat controls are layered: HMAC OTP and hashed capability/refresh tokens;
token-family replay detection; country/phone/IP/SMS cost caps; verified and
idempotent provider callbacks; owner-scoped queries and role tests; SMS code,
daily caps, fresh admin MFA and second approval for larger withdrawals;
delivery-code limits plus rider vetting/event records; masked logs, encrypted
TOTP/backups, least-privilege database accounts; CSP/HSTS, cookie-origin
controls, no tokens in browser storage, dependency/secret scanning; and
append-only audit/separation of duties.

## Roadmap and decisions

1. **Foundation:** auth, merchants, voice products, shop pages, single-shop
   baskets, M-Pesa, notifications, rider delivery, admin approvals, ledger and
   manual withdrawals. Exit: five merchants take real orders and receive
   withdrawals.
2. **Baskets:** same-zone multi-shop basket, multi-stop delivery, partial
   refunds, route proposal and per-shop tracking. Exit: four-shop one-rider
   order delivered.
3. **Automation:** automatic payouts/refunds, reconciliation dashboards,
   two-person approval and reporting replica.
4. **Growth:** more zones/languages, promotions, repeat customers and optional
   WhatsApp.
5. **Financial layer:** verified history/trust scoring/savings/lending only
   with confirmed regulated partner and legal path.

Still open (never silently hard-code): legal entity/M-Pesa account ownership;
merchandise commission and production delivery routing/fees; earnings hold;
withdrawal charge; zone size and ownership; all-ready vs rolling rider dispatch; tracking
URL alias; and pilot marketplace vs link-first discovery. Section 20 gives
suggested defaults and known operational, financial, regulatory, voice-quality
and team-capacity risks. The approved sandbox delivery fee defaults are
documented in [`decisions/fees.md`](./decisions/fees.md).

## Glossary

- **Basket:** one customer purchase across one or more shops, paid once.
- **Vendor order:** the part of a basket belonging to one shop.
- **Stop:** a shop pickup or customer drop-off in one delivery.
- **Zone:** a market/neighbourhood where shops may be combined.
- **Ledger:** append-only, zero-sum record of money movement.
- **Withdrawal:** merchant/rider request to move available earnings to M-Pesa.
- **STK Push:** M-Pesa payment prompt approved on the customer's phone.
- **OTP:** one-time code sent by SMS or voice.
- **Capability link:** unguessable bearer token scoped to one resource.
- **Idempotent:** safe to repeat without duplicating the effect.
- **Outbox:** message row committed with the event and delivered after commit.
- **PWA:** installable progressive web app.

Confirm Daraja, SMS gateway, speech/LLM provider, browser API, current
pricing and legal points against authoritative current sources at
implementation time. The architecture is technical guidance, not legal advice.
