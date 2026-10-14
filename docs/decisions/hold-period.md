# Earnings hold period

**Status: open.** Firm invariant: earnings are credited only after successful
basket delivery. The optional delay before those credits become withdrawable
is a configuration/ledger policy; architecture suggests 24 hours to cover
disputes but explicitly leaves it configurable.

Decide whether no hold or a duration; what starts/pauses/releases it; treatment
of partial refunds, failed delivery and disputed items; merchant vs rider
differences; user communication; and interaction with payout-day/service
targets. Do not represent CUSTOMER_FUNDS as merchant AVAILABLE during a hold.
Record owner, effective timestamp, migration behavior and ledger tests before
implementation.
