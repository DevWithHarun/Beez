# Refunds

List pending/completed refund records by basket and optionally vendor-order
part, amount, reason, status and provider/manual reference. Phase 1 refund is
sent manually and reference recorded by an authorized admin. Backend must
create balanced reversal entries and update payment/order state atomically;
UI cannot edit amount after approval or mark a refund complete without
reference/evidence. Require MFA and audit.
