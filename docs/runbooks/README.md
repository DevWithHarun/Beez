# Operations runbooks

Runbooks are intentionally readiness-gated. Current pages capture the hazard
and the information an on-call operator must add; they are not sufficient
instructions to move real money or access customer records.

| Incident | Runbook | Required before marked ready |
| --- | --- | --- |
| STK/payment stuck or orphaned | [`payment-stuck.md`](./payment-stuck.md) | Daraja status query, duplicate-safe evidence, customer response, authorized refund/reconciliation |
| SMS provider down | [`sms-down.md`](./sms-down.md) | Provider status/escalation, retry/voice fallback, SMS spend cap, affected-auth impact |
| Ledger mismatch | [`ledger-mismatch.md`](./ledger-mismatch.md) | Read-only zero-sum/account checks, evidence retention, approval and compensating-entry procedure |
| Withdrawal dispute | [`withdrawal-dispute.md`](./withdrawal-dispute.md) | Identity/ownership check, M-Pesa reference verification, MFA/second approval, customer communication |

Also required before pilot: rider not accepting, account takeover, failed
delivery, backup restore, and provider outage contacts. Every ready runbook
needs owner, last-tested date, severity/trigger, safe diagnostic commands,
escalation, recovery, customer comms and post-incident review. Never put
credentials, full phone numbers or unmasked customer data in a runbook.
