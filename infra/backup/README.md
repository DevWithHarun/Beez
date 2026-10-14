# Backup and disaster recovery

Protect PostgreSQL snapshots/PITR and private object media. Encrypt backups,
store a copy with a second provider/account, restrict restoration access, and
never expose production backups to dev. Architecture pilot targets RPO under
15 minutes and RTO under two hours; test and revise against the selected
provider.

Before production, document schedule/retention/keys, database and object
restore order, integrity checks, secret rotation, DNS/traffic switch, owner and
communications. Restore to an isolated environment quarterly, prove order,
ledger and media integrity, and record duration. No backup credentials or
working restore script are configured yet.
