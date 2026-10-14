# Merchant/rider approvals

Queue merchants/riders in onboarding/pending-review, show only necessary shop
or private rider evidence to authorized admin. Approve/reject with explicit
reason and recent TOTP proof; write actor/target/before/after to audit and send
localized notice through outbox. A merchant is public only when ACTIVE;
riders cannot see jobs until approved and ACTIVE. Do not approve via direct
database write.
