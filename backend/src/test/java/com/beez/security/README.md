# Security test matrix

Every endpoint must have positive role and negative cross-role/ownership cases.
Another user's record returns 404. Cover merchant/rider pending/suspended
status; one-phone/one-role conflicts; OTP enumeration, expiry, guesses,
resend/rate limits; refresh rotation/reuse revocation; cookie Origin/custom
header/no-store/CSRF; admin password lockout, TOTP freshness, backup-code
single use and audited actions; capability scope/expiry/referrer/cache; forged,
duplicate and mismatched M-Pesa callbacks; webhook secret/log exposure; rider
location freshness; delivery-code brute force lock; withdrawal race/daily cap
and second-approver policy.

Use fake providers, deterministic clocks/IDs and isolated database state; never
real phone numbers, secrets, live Daraja accounts or production records. This
matrix must grow with endpoint inventory. No product security endpoints exist.
