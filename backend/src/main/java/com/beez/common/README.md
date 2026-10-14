# Common kernel

This package contains only cross-module primitives that do not own a business
aggregate: normalized error/request-ID types, whole-KES money values, injectable
UTC clock, UUID/opaque ID helpers, phone/PII masking, idempotency abstractions,
and rate-limit contracts.

Do not move basket pricing, account balances, merchant authorization, or status
transitions into `common`; those belong to their owning module. Shared code
must not introduce dependencies between modules. Redis-backed limits are a
port here with the Redis implementation wired by `config`.

Money uses integer Kenyan shillings at API and persistence boundaries, not
floating point. Ledger balance logic remains in Wallet.
