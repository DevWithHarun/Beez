# Beez

Beez is voice-first commerce infrastructure for street vendors and small shops.
Customers can discover shops, place one basket across several nearby vendors,
pay once with M-Pesa, and receive the combined order from one rider. Merchants
and riders work in role-specific areas and earn through an auditable,
double-entry ledger. Customers can check out as guests.

The authoritative v1 product and production design is
[`docs/production-architecture.html`](./docs/production-architecture.html).
Use [`docs/architecture-map.md`](./docs/architecture-map.md) as the repository
index and module ownership guide. If a README or implementation conflicts with
the architecture, stop and resolve the discrepancy before building a feature.
Decisions explicitly marked as placeholders or open in the architecture must
not be treated as approved product policy.

## Product roles and app surfaces

- **Customer (guest):** Discover shops and products, build a multi-shop basket,
  pay by M-Pesa, and track one delivery through a capability link.
- **Merchant:** Enter through Sell using phone/SMS-code authentication; manage
  one shop, its products, shop media and vendor-order parts; review earnings
  and request withdrawals.
- **Rider:** Enter through Ride using phone/SMS-code authentication; admin
  approval precedes jobs; manage availability, multi-stop delivery, earnings
  and withdrawals.
- **Admin:** Separate `/admin` route and sign-in using email, password and
  authenticator. All sensitive actions are audited.

The launch app has four tabs: Discover, Track, Sell and Ride. Admin is not a
tab. A purchase flows from Discover/Checkout to merchant Sell orders, then
Rider jobs/Active delivery, Customer Track, and finally merchant/rider earnings
and the Admin withdrawal queue. Tabs do not call each other directly; server
state and events keep each view in sync.

## Architecture at a glance

One stateless Java 21 / Spring Boot 3 modular monolith owns business rules and
is the source of truth for prices, fees, authorization, states and money. It
uses PostgreSQL 16 and Flyway for durable data, Redis for distributed limits,
short-lived locks and cache, and S3-compatible object storage for media.
Provider APIs sit behind interfaces: Safaricom Daraja, the SMS gateway, Web
Push, speech-to-text, LLM extraction, and storage. The PWA is React, TypeScript,
Vite and Workbox. The admin console is a separate route group and bundle in the
same web codebase.

Business packages own their tables and behavior. Modules communicate through
service interfaces, not direct access to another module's repositories or
tables. See the
[backend module map](./backend/README.md) and
[architecture map](./docs/architecture-map.md).

## Money and order invariants

- One basket contains one vendor order per shop and one delivery with a stop
  per vendor order.
- A basket may contain shops only from the same service zone. The server
  re-reads and prices products; client prices are never trusted.
- One STK Push charges the complete basket. No merchant or rider is alerted
  until a verified payment is committed.
- Balances are sums of immutable ledger entries. Every ledger transaction
  balances to zero; never create an editable balance field.
- Earnings become available only when the basket is delivered (an optional
  configured hold is an open decision). A withdrawal moves `AVAILABLE` to
  `HELD`, then pays or releases the hold.
- Callbacks, transitions, payment, refund and withdrawal commands are
  idempotent. Status transitions and ownership are enforced by the server.
- Voice-extracted products remain drafts until the merchant reviews and
  confirms them. Every voice path has a typing fallback.

## Repository map

| Path | Responsibility |
| --- | --- |
| [`backend/`](./backend/README.md) | One deployable Spring Boot application and its module-owned business logic |
| [`web/`](./web/README.md) | Existing public landing page plus target PWA app-shell and feature boundaries |
| [`docs/`](./docs/architecture-map.md) | Architecture source, API contract, runbooks, decisions and module map |
| [`e2e/`](./e2e/README.md) | Phone-viewport Playwright journeys across customer, merchant, rider and admin |
| [`marketing/`](./marketing/README.md) | Standalone company page and shared footer |
| [`infra/`](./infra/README.md) | Local Compose, container builds, and future deployment/operations assets |
| [`scripts/`](./scripts/README.md) | Explicitly guarded bootstrap and ledger-operation tooling |
| [`.github/workflows/`](./.github/workflows/) | CI quality gates and deployment pipeline scaffold |

## Current implementation status

The production architecture is the agreed design map, not a claim that every
feature is already implemented. The existing web route is still the marketing
landing experience. Backend modules, product flows, real migrations,
provider adapters, accounting controls, executable Playwright flows, and
production deployment must be built and reviewed incrementally. The migration
files currently mark expected ordering only; they are not runnable schema
migrations until replaced by reviewed DDL.

The requested architecture excludes loans, credit scoring, financing,
inventory forecasting and AI business advice from the initial product. The
financial layer is a later phase and requires legal/regulatory review.

## Development

Copy `.env.example` to the ignored root `.env` and fill only the secrets needed
for the service being run. Never commit `.env`, provider credentials, or
production data.

Web (Node 22):

```sh
cd web
npm ci
npm run dev
npm test
npm run build
```

Backend (JDK 21 and Maven 3.9+):

```sh
cd backend
mvn spring-boot:run
mvn verify
```

The app health endpoint is `/actuator/health`. Start local PostgreSQL, Redis
and the backend with
`docker compose -f infra/compose/docker-compose.dev.yml up -d --build`;
MinIO remains optional. Do not use the production Compose placeholder as a
deployment configuration.

## Before implementing a feature

1. Read the relevant architecture sections and module README.
2. Confirm dependencies and ownership in `docs/architecture-map.md`.
3. Resolve related items in `docs/decisions/`; mark tentative values as
   tentative in code/config.
4. Define migrations, API contracts, authorization and state transitions
   together with tests before exposing a workflow.
5. For money or identity changes, include idempotency, auditability,
   reconciliation/retention implications, and negative security tests.
6. Update the module README and architecture/API docs in the same change.
