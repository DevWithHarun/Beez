# Infrastructure and deployment

`backend/Dockerfile` builds a non-root backend image. `compose/` contains a
local development stack (PostgreSQL, Redis, MinIO with local-only credentials,
and the backend) and an intentionally empty production placeholder. The
backend service loads application settings from the repository-root `.env` and
runs the `sandbox` profile for local OTP testing. Its SMS gateway sends real
messages and may incur charges; only request codes for phones you control.
Do not expose development passwords or ports on public interfaces.

`proxy/`, `monitoring/` and `backup/` document target responsibilities, but
have no production-ready configs yet. The architecture target is TLS/WAF/rate
limits at the edge; stateless API containers with at least two instances as
traffic requires; PostgreSQL primary/replica and encrypted offsite backups;
Redis shared rate-limits/locks; private object storage; Prometheus/Grafana,
Sentry, uptime checks and tested restore. Exact hosting provider is open.

Local: Compose + sandbox SMS/mock M-Pesa. Staging: each merge, test data and
provider sandboxes. Production: real data/providers, secret manager, approved
tagged release, rolling health checks and rollback. A deployment workflow must
not deploy until an operator configures a target, credentials, smoke tests and
rollback. Pilot restore targets in the architecture are RPO <15 min and RTO
<2 hours, verified quarterly.
