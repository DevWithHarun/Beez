# Audit log

Append-only view of admin action, actor, target, timestamp, request ID, reason
and before/after summary. Search/filter is read-only; no edit or delete. Mask
PII/secrets from the rendered details and exports. Audit is written in the
same transaction as sensitive action where possible; failed attempts/security
events are recorded by Auth/operations as specified. Finance CSV exports are
also logged.
