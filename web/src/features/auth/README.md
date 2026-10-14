# Auth screens

The frontend presents the backend Auth contract; it does not create identity
or authorize access on its own. Entry is role-aware: merchant and rider phone
sign-in/onboarding; guests remain anonymous; admin has separate email/password
plus authenticator route under `/admin`.

Merchant/rider flow: large English/Swahili language choice saved on device →
formatted Kenyan phone and large numeric keypad → request a six-digit SMS
code → six large code boxes with `autocomplete="one-time-code"`/WebOTP →
verify and receive short-lived access token in memory plus HttpOnly refresh
cookie. Offer voice-call code fallback and listen/read-aloud controls. Copy
must not reveal if a phone is already registered. Preserve account-pending,
role-conflict, rate-limited, expired-code, SMS-unavailable and attempt-count
states from the API.

The `/app` entry screen provides role selection, phone entry, six-digit code
entry and merchant/rider onboarding. OTP request/verify call the implemented
`/api/v1/auth/otp/*` endpoints. A verified phone creates the user if needed;
the profile form then saves the display name and merchant shop/market details
or rider delivery area through `PATCH /api/v1/auth/me`. Access tokens stay in
the in-memory session module. Customers continue as guests and do not need an
account.

Local development disables SMS in the `dev` profile. To test account creation,
run the backend with the `sandbox` profile and configure `SMS_API_KEY` plus an
approved `SMS_SENDER_ID`. The sandbox profile uses the configured live SMS
gateway endpoints, so only request a code for a phone you control; OTP sends
may incur charges. Never log, return, or commit OTPs or provider credentials.

Refresh uses the HttpOnly cookie through a single-flight helper; access tokens
never enter localStorage/sessionStorage. Auth ownership/security details, rate
limits and token rotation are in backend Auth README and architecture section
10.
