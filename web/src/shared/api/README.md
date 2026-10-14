# Typed API client

One typed client targets `/api/v1` and owns base URL, JSON encoding, request
IDs, response/error parsing, cursor pagination and `Idempotency-Key` for
retryable writes. API errors use `{ error, message, details, requestId }`;
money inputs/outputs are integer whole KES with `*Kes` names.

Attach short-lived access JWT from the in-memory Auth store. On an eligible
401, invoke one shared single-flight refresh (`POST /auth/refresh`) using
same-origin credentials and `X-Beez-Client: pwa`; other concurrent requests
await that refresh rather than replaying the old cookie. Do not blindly retry
non-idempotent writes. Clear session/push state on logout and surface
`refresh_reused` as reauthentication/security event.

Guest basket routes use their one-basket capability in the documented route
contract; avoid putting tokens in analytics/referrer URLs and use `no-store`.
Private/user/payment responses are never service-worker cached. The endpoint
inventory is architecture section 13; the backend and client currently have
no integrated product API.
