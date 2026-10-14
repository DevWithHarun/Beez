# Operations module

The operations API currently supports a pending rider-approval queue and
pending merchant refund requests. An operator can approve a rider, confirm an
externally completed M-Pesa refund with its provider reference, or mark a
refund request failed with a reason. These actions are audited and require an active `ADMIN` identity. The HTTP
surface also requires an admin JWT; write actions require an authenticator
step-up verified within the last ten minutes. Admin identities are provisioned
separately from merchant/rider OTP accounts. The dashboard currently covers
these queues only; other pilot and later-phase workflows remain unimplemented.

Refunds are not initiated by this service: a merchant rejection creates a
pending item-level request, and an admin records the result only after handling
the refund through the provider. Refund/payout API integrations, maker-checker,
version checks, idempotency keys, and hash-chained audit are not implemented.
