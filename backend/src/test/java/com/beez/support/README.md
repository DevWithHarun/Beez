# Integration test support

Use Testcontainers PostgreSQL to exercise real transactions, constraints,
Flyway upgrades and concurrent operations. Add isolated fake Daraja, SMS,
Web Push, speech, LLM and S3 ports that record requests and can inject timeouts,
duplicates and malformed responses. Fixed clocks/random sources make OTP,
expiry, retries and idempotency deterministic.

Test fake SMS delivery to OTP/outbox, mocked STK callbacks and status query,
provider contract fixtures, concurrent rider accept (one winner) and
withdrawal balance lock. No fake sends externally or stores actual secrets.
Do not replace integration database semantics with an in-memory substitute.
