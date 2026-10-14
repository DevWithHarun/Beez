# Admin module

Admin is a separate `/admin` route group/bundle and sign-in, not one of the four
app tabs. This backend module owns admin workflow/read models, approvals,
manual operational actions, metrics and an append-only audit log. It calls
domain services; it never reads/writes another module's tables or implements
money logic itself.

Console areas: Overview (orders/value/shops/riders/delivery/failures);
Approvals (merchant/rider evidence, approve/reject with reason); Orders
(basket, parts, stops/timeline, cancel/reassign/failure handling); Payments
(stuck/orphan/re-check); Withdrawals (pay with reference/reject with reason);
Ledger (view-only); Refunds; Users (suspend/restore/logout-all); Metrics; and
Audit log (append-only before/after).

No public admin sign-up. Admin uses email, password and TOTP; backup codes are
single-use. Sensitive approve/suspend/pay/refund actions require a fresh MFA
check within ten minutes and create an audit row. Payouts above the agreed
threshold need second-person approval. CSV export is restricted to finance
admins and logged. Admin roles may later split into support/finance/super
admin.

Admin is never a shortcut around module authorization or ledger invariants.
Architecture sections 10 and 14 define exact controls. Routes and UI are not
implemented.
