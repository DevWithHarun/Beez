# Admin console

The admin product follows
[`../../../../Downloads/beez-admin-dashboard-architecture.html`](../../../../Downloads/beez-admin-dashboard-architecture.html)
and its four-phase roadmap. It is a separate `/admin` route and bundle, not a
customer/merchant/rider tab.

## Implemented foundation

- A separate admin email/password/TOTP sign-in; public merchant/rider OTP
  endpoints cannot create or sign in as admins.
- One-time initial account provisioning from server environment settings.
  Admin passwords use BCrypt cost 12 and authenticator secrets are encrypted
  with AES-GCM. Access tokens are memory-only, limited to eight hours, and
  logout revokes them through the user token version.
- Authenticator step-up expires after ten minutes for admin write operations.
- Admin-only rider approval and merchant-refund queues are available through
  operations endpoints. Refund resolution and rider approval are server-checked
  and recorded in the current operations audit table.
- The Overview reads its operational metrics from the admin-only
  `/api/v1/operations/dashboard` endpoint. It reports basket orders and verified
  payment value for the Africa/Nairobi business day, active merchants and
  approved riders, delivery throughput, open and failed deliveries, and
  outstanding work queue counts. Metrics refresh automatically every 30
  seconds and can be refreshed manually; the endpoint is not cacheable.

## Rollout status

This is the start of roadmap Phase A, not yet a pilot-ready admin system. The
dashboard has real pending rider and merchant-refund queues, including
step-up-protected approval/resolution actions. It still needs the remaining
real data views and workflows for merchant approvals, orders/timelines,
exceptions, payments, withdrawals, read-only ledger, user suspension, and audit.

Phase B adds database-backed roles/permissions, MFA enforcement across every
sensitive endpoint, maker-checker, claims/versioning, masking, cases,
reconciliation, config, live counters, and exports. Phases C/D cover operational
automation, expanded analytics, multi-zone/country controls, and scale.

No admin system is production-ready until each action is authorized by the
server, uses the owning module's service interface, records complete
tamper-evident audit data, and has integration tests. The current operations
module still contains direct SQL against domain tables, and its audit records
are not hash chained.
