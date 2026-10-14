# Operational scripts

| File | Intended use | Readiness |
| --- | --- | --- |
| `seed-admin.sh` | Create the first admin, no public signup | Intentionally exits until Auth persistence and secure secret input exist |
| `seed-demo-data.sql` | Populate disposable local demo records | Empty marker until schema/fixtures are reviewed |
| `check-ledger.sql` | Read-only nightly zero-sum/balance invariants | Empty marker until ledger schema and production read-only credentials exist |

Scripts must fail safely, validate target environment, be idempotent where
possible, use least privilege and never print secrets or customer identifiers.
Never run seed/demo SQL against production. Ledger check should be read-only;
repairs are new audited reversing entries through Wallet services, never SQL
updates. Add dry-run/output totals and owner/review before making any script
operational.
