# Observability

Target stack: structured JSON logs, Prometheus metrics/Grafana, Sentry and
external uptime checks. Logs carry request ID plus basket/payment/withdrawal
IDs for one-trace support; mask phone numbers, never log secrets/OTP/capability
tokens, and control access/retention.

Dashboards/alerts cover app/API availability (down 2 min, error rate >2%);
STK success/failure/pending age/callback lag/orphan payments (pending >10 min
or any orphan); ready/accept/delivery latency and unclaimed jobs (10 min);
ledger zero-sum and daily statement reconciliation (any mismatch), withdrawals
unpaid >24h; OTP/refresh reuse/admin login/SMS spend; voice failures (>10%) and
correction rates; and CPU/memory/database/queue pressure. Thresholds are
architecture pilot suggestions and require owner/tuning.

Every alert needs a linked ready runbook, severity, on-call and fallback
contact. No metrics, Grafana dashboards, Sentry project or uptime checks are
configured yet.
