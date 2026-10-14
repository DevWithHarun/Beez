# Payment module

**Owns:** payment attempts, provider references, callback inbox and
verification. A basket is charged once for its full server-priced total;
shops/riders are not paid separately at checkout. Merchant payout is a later
phase.

Sandbox checkout creates `INITIATED`, obtains/caches Daraja OAuth, sends STK
Push, stores provider request IDs, and then marks the attempt `PENDING`.
Credentials and callback configuration are environment-only. The callback URL
must be public HTTPS and contain a unique high-entropy path token. Unconfigured
or malformed callback settings fail closed; `MPESA_BASE_URL` defaults to the
Daraja sandbox endpoint.

The callback endpoint stores the JSON inbox event and acknowledges promptly.
A scheduled worker claims inbox records with `SKIP LOCKED`, looks up the unique
checkout request ID, queries Daraja transaction status, and compares successful
callback amount, phone, receipt and request IDs. Mismatches move to `REVIEW`
and never mark orders paid. Verified settlement marks payment, basket and
vendor orders paid in one transaction. Failed or duplicate results are
idempotent, and stale claims are retried.

The Wallet module records verified incoming payments, and the payment-start
response returns a six-digit delivery code to the basket owner. Merchant
rejection creates a pending refund request; an operator must execute the
external M-Pesa refund and record its reference before the ledger records the
outflow.

**Not production-complete:** reconciliation of missing callbacks or statement
differences, Admin review tooling, automatic refunds and merchant payouts are
not implemented. Do not switch to Daraja production until the sandbox has
been validated, production credentials and HTTPS callback are configured, and
operations/reconciliation handling is in place. Secrets, callback tokens and
customer phone numbers must never be logged.
