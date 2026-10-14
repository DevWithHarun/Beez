# Application configuration

`config` is the composition root for Spring Security, CORS, Jackson, request
validation, scheduling, typed properties, persistence, Redis, object storage,
and provider adapters. Controllers and domain services must not construct
provider clients or read secrets directly.

Use `application.yml` for safe shared defaults, `application-dev.yml` for local
development, and `application-prod.yml` for production-safe behavior. Secrets
come from the environment/secrets manager; they never go in YAML, images, or
logs. Profile-specific configuration must not silently weaken authorization,
CSRF/cookie-origin checks, or callback verification.

The auth slice configures Spring Security as a stateless JWT resource server,
PostgreSQL/Flyway with schema validation, Redis-backed fail-closed rate limits,
strict allow-listed CORS, and profile-specific cookie/SMS behavior. JWT and OTP
HMAC keys are separate environment secrets. Never enable a wildcard credential
origin or log secrets/OTP values. In `dev`, SMS is deliberately unavailable;
the `sandbox` and `prod` profiles use the BlessedTexts gateway with VasPro
failover and require an approved sender ID and gateway API key. Both profiles
use live provider endpoints; sandbox does not simulate or suppress SMS sends.
