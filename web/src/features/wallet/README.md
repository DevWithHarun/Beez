# Wallet UI shared by Sell and Ride

The frontend displays server-derived available/held balances, delivered
earnings/history and the user's own withdrawal requests. It never computes an
authoritative balance or edits transaction history. Amounts are whole KES.

Withdrawal is a shared sheet: request a six-digit SMS confirmation code, enter
an amount meeting the configured minimum and not exceeding available balance
or daily cap, then confirm. Show REQUESTED/PROCESSING/PAID/REJECTED/FAILED,
timestamps and M-Pesa reference/reason. The destination is the registered
payout phone; UI cannot silently choose an arbitrary account. On rejection,
explain that held funds are released. Phase 1 payout is manually processed by
Admin; do not display it as automatic.

Backend Wallet enforces one open request, balance lock, idempotency, hold
ledger entry and audit/MFA on payment. Suggested KES 100 minimum, KES 20,000
daily cap, 24-hour number-change delay, one-business-day payout and fee
absorption are initial values/open decisions, not fixed UI constants. No
wallet API exists yet.
