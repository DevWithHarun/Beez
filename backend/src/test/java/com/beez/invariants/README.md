# Money and order invariants

Run at unit and PostgreSQL integration levels; mirror critical checks in a
nightly read-only ledger job once production exists:

- Every ledger transaction sums to zero; entries are immutable; account
  balance equals sum of entries and AVAILABLE never becomes negative.
- Customer funds remain unallocated before delivery; delivered split equals
  shop net amounts + rider fee + Beez revenue.
- Basket total equals item totals/vendor subtotals plus delivery fee; a
  rejection/out-of-stock/refund changes totals and reversal in one transaction.
- One basket has one payment/delivery; one delivery stop per active vendor
  order; stop sequence unique; single open withdrawal per user.
- Payment callbacks/withdrawals/delivery status retries are idempotent.
- Withdrawal HELD resolves exactly once to payout or release.

Use integer KES only. For SQL/job checks, show failing transaction/reference
and page an operator; never auto-edit a balance. No production schema exists.
