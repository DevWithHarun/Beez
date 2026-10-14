# PostgreSQL / Flyway migration plan

Target PostgreSQL 16, UUID primary keys, UTC timestamps, whole-KES integer
amounts, foreign keys/checks/unique constraints and indexes as specified in
section 4 of the production architecture. Modules own schema changes and
coordinate cross-module foreign keys via architecture review; don't let one
module write another's tables.

The ordered filenames represent the intended rollout grouping:

| Version | Intended schema ownership |
| --- | --- |
| `V001__auth.sql` | Users, OTP challenges and rotating refresh-token families |
| `V002__catalogue.sql` | Zones, merchants, products |
| `V003__baskets_orders.sql` | Baskets, vendor orders, item snapshots |
| `V004__payments.sql` | Payments, callback inbox, refunds |
| `V005__dispatch.sql` | Riders, deliveries, stops |
| `V006__ledger_withdrawals.sql` | Ledger accounts/transactions/entries, withdrawal |
| `V007__notifications_audit.sql` | Outbox notifications and admin audit |

`V001__auth.sql` is the first active migration. Later filenames in the table
are reserved in the design only; don't add empty/comment-only files because
Flyway would mark them applied and block their later use. Add each migration
only with reviewed, transaction-safe DDL, a deferred zero-sum ledger
constraint, one-open-withdrawal partial unique index, appropriate ownership/
unique indexes, and Testcontainers upgrade tests. Use expand → migrate →
contract so old/new app instances overlap safely. Never rewrite an applied
migration; add a new version.
