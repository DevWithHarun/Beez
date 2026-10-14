# Wallet and ledger module

**Owns:** ledger accounts, immutable ledger transactions/entries, derived
balances, holds, withdrawals, settlement and wallet-facing earnings history.
Only Wallet writes ledger rows; all balances are `SUM(entries)`, never a
mutable stored number. Credits are positive, debits negative, and every
transaction sums to zero, enforced by service logic plus a deferred database
constraint/invariant test.

Current accounts: per-merchant `MERCHANT_AVAILABLE`, per-rider
`RIDER_AVAILABLE`, plus Beez `CUSTOMER_FUNDS`, `PLATFORM_REVENUE` and
`PAYMENT_CLEARING`. Verified payment books the full customer payment. On
verified delivery, Wallet allocates each shop merchandise subtotal between
the merchant (95%) and Beez commission (5%, rounded to the nearest KES), and
allocates the basket delivery fee between the assigned rider (95%) and Beez
(5%, rounded to the nearest KES). Both allocations are atomic with successful
delivery confirmation; ledger entries are immutable and each transaction
balances.

Withdrawal phase 1: user requests SMS confirmation code; verify single-use
code, lock/read AVAILABLE account, enforce KES 100 minimum, configured daily
cap, registered payout number and one open request/user; atomically write
`AVAILABLE -amount`, `HELD +amount` and REQUESTED row. Admin manually sends
M-Pesa then records reference/MFA/audit; payment debits HELD and CASH. Reject
releases HELD back to AVAILABLE. One open request is enforced by unique
partial index. Suggested daily cap KES 20,000, 24-hour payout-number-change
delay and fee policy are placeholders/open decisions.

Phase 2 may integrate approved Daraja B2C: PROCESSING and PAYOUT_CLEARING,
callback-safe completion, one safe retry, then release hold and alert on
failure. High-value payout needs two-person approval; all payouts reconcile
daily with M-Pesa. Customer refunds are reversals, never edits.

Merchant earnings summary/history are exposed through
`GET /api/v1/merchants/me/earnings` and `/history`; rider earnings summary and
history are exposed through `GET /api/v1/riders/me/earnings` and `/history`.
Customer refunds are confirmed externally by an operator after an M-Pesa
refund; confirmation is recorded in the ledger. Rider withdrawals and
automatic M-Pesa payouts are not implemented. No other module edits ledger
entries.
