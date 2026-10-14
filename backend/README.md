# Backend: modular monolith

## Runtime boundary

One deployable Java 21 / Spring Boot 3 application owns the API, domain rules,
and background jobs. PostgreSQL 16 is the durable source of truth, Redis
coordinates shared rate limits/short locks/cache, and private S3-compatible
storage holds media. This is intentionally one application, not a set of
microservices. The package dependency rule is the important seam:

1. A module owns its aggregates, repositories, transactions and state changes.
2. Other modules call its public service interface; they never inject its
   repository or query its tables.
3. Provider interfaces (SPIs) belong to the consuming business module.
   Implementations are under `com.beez.adapters`; `config` wires them.
4. Controllers validate/map transport objects and call application services.
   They do not implement business rules or call another controller.
5. `common` contains small cross-cutting primitives, not shared business logic.

The module dependency/ownership table, data model, sequence diagrams, invariants
and endpoint catalogue are maintained in
[`../docs/architecture-map.md`](../docs/architecture-map.md) and the
[production architecture](../docs/production-architecture.html).

## Module map

| Package | Owns | Main collaborators |
| --- | --- | --- |
| `auth` | User identity, OTP, session/refresh-token families, roles, admin MFA | Notification SMS SPI, Redis limits |
| `catalogue` | Zones, merchant/shop profile, product/stock, media references | Voice confirmation, object-storage SPI |
| `voice` | Upload, transcript, extracted product draft and confirmation lifecycle | Speech/LLM SPIs, Catalogue service |
| `basket` | Basket, item price snapshots, vendor-order parts, pricing/fees and order state | Catalogue, Payment, Dispatch and Wallet services |
| `payment` | STK attempts, callback inbox, verification, reconciliation and refunds | Payment provider SPI, Basket and Wallet |
| `dispatch` | Rider profile/availability/location, delivery, stops, offer/claim, delivery code | Basket/order and Notification services |
| `wallet` | Immutable double-entry ledger, derived balance, holds, withdrawals and settlement | Payment, Admin, M-Pesa later |
| `notification` | Transactional outbox, localized templates, push/SMS delivery and ack/retry | Channel SPIs |
| `admin` | Approvals, ops/read models, audited privileged actions | All modules through service interfaces |
| `common`, `config` | Shared primitives and application composition | No ownership of product aggregates |
| `adapters` | Daraja, SMS gateway, Web Push, speech, LLM, S3 implementations | Implements module-owned SPIs |

## Core records and invariants

Identity rows (`users`, `otp_challenges`, `refresh_tokens`, `auth_events`,
`admin_backup_codes`, `push_subscriptions`) support the actors described in the
architecture. Catalogue records are zones, merchants and products. A basket
has one unique vendor-order part per merchant; items snapshot name, unit price
and quantity. One basket has one payment and one delivery, with an ordered
delivery stop for each vendor order. Withdrawals, refunds, ledger entries,
outbox notifications and audit rows reference the relevant aggregate IDs.
Section 4 of the HTML architecture is the complete proposed schema inventory.

All IDs are UUID unless specified otherwise, timestamps are UTC, and money is
integer KES. Server-side price/fee calculations are authoritative. Ledger
entries are immutable, use positive credits/negative debits, and every ledger
transaction sums to zero. Balances are computed from entry sums. Basket total
equals goods plus delivery fee. Any refund and ledger reversal must commit
atomically with its associated state change. Callback, payout and state-change
commands are idempotent.

These invariants require database constraints plus service tests; controller
validation alone is insufficient. Never add an editable balance column or
allow admin code to edit ledger rows.

## API and security

REST/JSON is versioned under `/api/v1`; errors are
`{error, message, details, requestId}`, list responses are cursor-paginated,
money properties end in `Kes`, and retryable writes accept `Idempotency-Key`.
Route families and roles are in section 13 of the architecture and
[`../docs/api/openapi.yaml`](../docs/api/openapi.yaml).

Apply Spring Security role gates, ownership-scoped reads (another user's
record returns 404), approved/active status checks, explicit state-machine
guards, and atomic conditional updates for job claims and withdrawals. Admin
money/security actions require fresh MFA and append-only audit. M-Pesa
callbacks are stored raw, acknowledged quickly, processed once, and verified
through Daraja status/amount/reference before marking a basket paid. Do not
trust callback JSON alone.

The architecture specifies OTP HMAC storage and attempt limits, short-lived
access JWTs kept in browser memory, rotating opaque refresh cookies with replay
detection, guest basket capabilities stored hashed, and separate password +
TOTP admin auth. It also specifies Redis-backed rate limits and callback,
checkout, delivery-code and SMS-spend controls. Implement these as one cohesive
security boundary; do not build a route before its actor, ownership and abuse
limits are defined.

## Local development and current status

Requires JDK 21 and Maven 3.9+. `mvn spring-boot:run` starts the application;
`/actuator/health` is its health endpoint. Run `mvn verify` for backend tests.
Local Postgres, Redis, MinIO and backend definitions are in
[`../infra/compose/docker-compose.dev.yml`](../infra/compose/docker-compose.dev.yml).
Build and start the backend stack with
`docker compose -f infra/compose/docker-compose.dev.yml up -d --build`.
Compose loads the repository-root `.env` into the backend container; the file is
excluded from the Docker build context. The backend is exposed at
`http://localhost:8080`; MinIO remains optional. The local Compose backend uses
the `sandbox` profile so login OTPs use the configured SMS gateways. These are
real outbound messages, not simulated SMS; use only a phone you control and
expect provider charges.
Auth uses the PostgreSQL and Redis services. MinIO is not yet used by auth.
Supply separate random `JWT_SIGNING_KEY` and `OTP_HMAC_KEY` values through the
process environment; Spring Boot does not load the repository `.env`
automatically. The `dev` profile intentionally has no SMS delivery and returns
an explicit unavailable error; it never logs or returns OTPs. Production and sandbox SMS use BlessedTexts first and fall back to VasPro if
the primary request fails or rejects the message. Configure `SMS_API_KEY` and
the provider-approved `SMS_SENDER_ID` in the environment used to start Maven;
never commit or paste API keys into the repository. `SMS_PRIMARY_API_URL`,
`SMS_FALLBACK_API_URL`, and `SMS_CALLBACK_URL` have safe provider defaults
(the callback defaults to an empty string); endpoint hosts and paths are
restricted to the configured providers. The `sandbox` profile still uses the
live gateway endpoints, so only enable OTP sends with a rotated key and a
safe test recipient.
Spring Boot does not read `.env` automatically. Generate distinct application
secrets with:

```powershell
$env:JWT_SIGNING_KEY = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:OTP_HMAC_KEY = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Start the local services with
`docker compose -f infra/compose/docker-compose.dev.yml up -d`.

To test merchant/rider account creation locally, configure `SMS_API_KEY` and
the approved `SMS_SENDER_ID` in the repository-root `.env`. Spring does not
load `.env` automatically; from the `backend` directory, load it into the
PowerShell process and start the sandbox profile:

```powershell
Get-Content ..\.env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"').Trim("'"), 'Process')
  }
}
$env:SPRING_PROFILES_ACTIVE = "sandbox"
mvn spring-boot:run
```

The `sandbox` SMS profile still uses the live provider endpoints. Request OTPs
only for test phones you control; messages may incur charges. Customers remain
guest-only. To explicitly run without SMS, change the Compose profile to `dev`;
OTP sign-in will then be unavailable.

The auth slice now uses Spring Security, OAuth2 resource-server JWT, Validation,
Spring Data JPA, PostgreSQL, Redis and Flyway. It requires PostgreSQL and Redis
to run, and production OTP additionally requires the SMS gateway credentials. Flyway
migrations `V001__auth.sql` and `V002__auth_onboarding_profile.sql` define the
identity/session schema and persisted account setup fields. Most non-auth
module READMEs describe planned behavior, not working endpoints.

## Implementation order

Follow the architecture roadmap, not package order: (1) foundation/auth,
catalogue and voice drafts, single-shop baskets/payment/outbox, dispatch,
admin approvals, ledger and manual withdrawal; (2) same-zone multi-shop and
partial refunds; (3) automated settlement and reconciliation; (4) zones,
languages and repeat-order growth; (5) regulated financial layer. Each feature
must update the API spec, schema, state machine, security tests, invariants and
its module README in the same change.
