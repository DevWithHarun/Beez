# Ride tab — rider workspace

**Actor:** an authenticated rider whose profile is ACTIVE/approved. Pending
riders see approval status, not jobs. A merchant phone cannot also become a
rider role; explain that a separate phone number is required.

Subareas: `onboarding/`, `jobs/`, `active/`, `earnings/`, and `profile/`.
Onboarding captures vehicle, plate, private ID/selfie, referee and area for
admin approval. Availability is an explicit AVAILABLE/OFFLINE switch. When
available and app-open, send location about every 15 seconds; request consent
and never treat stale (>2 minute) positions as eligible.

Jobs become offerable only after all active shop parts are ready. A card shows
stop count, route estimate and fee; first accept wins on server, so a losing
client refreshes instead of assuming assignment. Active lists ordered shop
pickups and last customer drop-off. Confirm pickup per stop; skip only rejected
or cancelled shop parts. At drop-off, enter customer's four-digit code; five
wrong attempts lock and alert Admin. Rider never sees the underlying HMAC.

Wallet earnings are credited only on delivery; withdrawal/history are shared
with Sell. Dependencies: Auth, Dispatch, Basket/Orders, Notification, Wallet,
shared location/map links and API. Do not fake jobs, live rider state or
earnings. No dispatch workflow is implemented.
