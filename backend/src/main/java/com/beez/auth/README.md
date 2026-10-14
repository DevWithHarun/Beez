# Auth module

**Owns:** users, OTP challenges, access/refresh sessions, roles, token-version
revocation, admin MFA/backup codes, auth events, and user-owned push
subscriptions. It exposes auth services to the web API and other modules;
only this module reads or writes its identity tables.

## Actor-specific sign-in

- **Merchant/rider:** normalized Kenyan `+254` phone, six-digit
  `SecureRandom` code, HMAC-SHA256 of challenge ID and code (never plaintext),
  five-minute expiry, five attempts, single use, resend after 60 seconds.
  Responses do not reveal whether an account exists. Voice-call code fallback
  must remain available. New merchants are `ONBOARDING`; new riders are
  `PENDING_APPROVAL`.
- **Customer:** no account or login. A random >=128-bit capability token grants
  access only to one basket; only its SHA-256 hash is stored. Expire seven days
  after delivery, do not cache capability responses, and do not leak tokens in
  referrers.
- **Admin:** separate named account; no public signup; email/password plus
  TOTP. Passwords use BCrypt cost 12, at least 12 characters, and at most 72
  UTF-8 bytes. TOTP secrets are
  AES-GCM encrypted. Five bad sign-in attempts lock the account for 15 minutes;
  login/step-up attempts are Redis rate limited. Admin access tokens last at
  most eight hours and are held in browser memory. Hashed backup codes, repeat
  lockout delay, admin team provisioning, and access review remain future work.

Merchant/rider access JWTs last 15 minutes; admin access JWTs last at most
eight hours. Both stay in browser memory and carry subject, role,
merchant/rider identity, token version, `jti`, issuer, audience and timestamps.
Refresh values are opaque 256-bit random tokens, stored server-side only as
SHA-256 hashes, rotated on every use, sliding 60-day with 180-day hard cap.
Replay revokes the full family and emits a security alert. Refresh cookies are
HttpOnly, Secure, SameSite=Lax, scoped to `/api/v1/auth`; cookie endpoints
require `X-Beez-Client: pwa`, Origin validation, `no-store`, and a single-flight
refresh client. Reject `alg:none`; key rotation uses `kid`.

Enforce one phone/role, account status and rider approval. Service queries are
scoped by principal/owner; a foreign record returns 404. Apply the architecture
rate limits (OTP per phone/IP, guesses, withdrawal codes, admin lockout,
refresh, SMS spend). Shared limits use Redis. Sensitive admin actions require
a recent authenticator code and are audited by Admin.

## Package responsibilities

- `api/`: implemented OTP request/verify, rotating refresh, logout/logout-all,
  `/auth/me`; admin password/TOTP login, step-up, `/admin/auth/me`, and
  revocable eight-hour sessions are implemented separately.
- `domain/`: User, OtpChallenge, RefreshToken family, AuthEvent and policy.
- `service/`: code generation/HMAC, constant-time verification, user
  provisioning, Redis rate limits, token issue/rotation/reuse response and
  account status.
- `repo/`: this module's persistence only.
- `spi/SmsSender`: outbound message port, implemented by Notification adapter.

Never put secrets/codes in logs. Keep auth errors generic where account
enumeration is possible. See architecture section 10 for database fields,
limits, routes, session details and error codes.

The working slice implements `/api/v1/auth/otp/login/request` for role-free
sign-in to existing merchant/rider accounts, `/api/v1/auth/otp/request` for
role-selected signup, `/api/v1/auth/otp/verify`, `/auth/refresh`, `/auth/logout`,
`/auth/logout-all` and `/auth/me`. OTP challenges and refresh-token hashes are
stored in PostgreSQL; rate limits are Redis-backed. SMS is wired to BlessedTexts
with VasPro failover in the `sandbox` and `prod` profiles and explicitly
unavailable in `dev`; there is no development OTP bypass or code logging. The web client keeps the
short-lived access token in memory only and refreshes with one single-flight
request. Admins cannot use public OTP signup or sign-in. Initial admin
provisioning is a one-time environment-configured bootstrap; it is ignored
after an admin account exists. `/auth/me` persists merchant shop name and market area or rider
delivery area along with the account holder's name; rider approval and the
merchant/rider workspaces remain future work. Voice fallback, admin backup
codes, auth-event retention cleanup, and full admin-team provisioning are not
implemented yet.

Admin bootstrap settings are `ADMIN_BOOTSTRAP_EMAIL`,
`ADMIN_BOOTSTRAP_PASSWORD` (at least 12 characters and at most 72 UTF-8 bytes),
and a >=128-bit Base32
`ADMIN_BOOTSTRAP_TOTP_SECRET`, together with `ADMIN_MFA_ENCRYPTION_KEY` (a
separate base64-encoded random 32-byte key). The bootstrap credentials create
only the first admin and are not a password-reset mechanism. Keep all values in
the process secret store; never commit them. No admin account is created if the
bootstrap settings are absent.

Required backend settings are `JWT_SIGNING_KEY` (base64 of >=32 random bytes),
`OTP_HMAC_KEY` (a separate secret of >=32 characters), database and Redis
URLs, and `WEB_ORIGIN`. The `prod` and `sandbox` profiles additionally require
`SMS_API_KEY` and an approved `SMS_SENDER_ID`; both use live provider endpoints.
Production has secure refresh cookies enabled. Do not use the
development Compose credentials in production.
