# Web application

## Purpose and runtime

One React + TypeScript + Vite PWA serves guest customers, merchants, riders
and admins. It is not four separate apps. The launch shell has Discover, Track,
Sell and Ride tabs; admin lives in a separately guarded `/admin` route group
and should be split into its own lazy bundle. Route groups are entry points
only—the backend remains authoritative for identity, ownership, prices, order
state and wallet balances.

The TanStack Start route `/` is the public marketing landing page. Its Launch
app links open `/app`, the first role-aware product entry screen. Customers see
the guest-access explanation; merchants and riders can request and verify a
phone OTP, create/sign in to a role-bound account, and save their name and
role-specific onboarding details. Session refresh uses an HttpOnly cookie;
access tokens remain in memory. Rider jobs are dispatch-backed; rider
delivery-fee earnings use the server ledger and are credited only after
customer-confirmed delivery. Riders remain pending approval after completing
profile setup.
`src/app/LaunchShell.tsx` remains a separate shell scaffold and is not the
runtime entry route.

## Route and feature map

| Route/surface | Feature package | Data/access |
| --- | --- | --- |
| `/` and first-time launch | App shell → Discover | Guest; defaults to Discover |
| `/app` | Role-aware launch/sign-in entry | Customer guest entry; merchant/rider OTP, account creation and profile setup |
| `/m/{slug}` | Discover shop page | Public active shop/product catalogue |
| `/track/{token}` | Track | Guest capability scoped to one basket; no-store response |
| `/sell/**` | Sell | Merchant account; caller's own shop and vendor-order parts only |
| `/ride/**` | Ride | Approved rider; own jobs, stops, earnings and profile |
| `/auth/**` | Auth | Language, phone, code; merchant/rider phone OTP |
| Shared withdrawal/history | Wallet | Own authenticated account; server-derived balances |
| `/admin/**` | Admin | Separate admin auth/MFA, separately lazy-loaded, every mutation audited |

Remember the last tab on device, but first visit opens Discover. Shop and track
deep links work without the tab bar. Signed-out Sell/Ride explain and offer
sign-in. One phone has one role; switching roles requires a different number.
Badges reflect server-backed attention (new merchant orders, available rider
jobs, active tracking). Load each tab lazily; keep Discover/Track the lightest.

## Module boundaries

`features/` owns feature behavior and screens. `shared/` owns typed API/token
refresh, in-memory auth/session guards, en/sw copy, reusable accessible UI,
voice recording/read-aloud, maps, push subscription, and formatting utilities.
Feature components call `shared/api`; they do not call one another's private
services. The client sends intent and displays server state—it does not decide
prices, roles, totals, fees, money, or legal transitions.

The target API convention is REST/JSON `/api/v1`, structured errors with
`requestId`, cursor pagination, integer KES `*Kes` values and
`Idempotency-Key` on retryable writes. Refresh is single-flight. Access tokens
live in memory only; refresh is an HttpOnly cookie. Never put private API
responses, auth, tokens, basket capabilities or rider locations in static
caches.

## PWA and accessibility

`public/manifest.webmanifest` is the install manifest. The service worker
caches only allow-listed same-origin public static assets; navigation, API,
auth, user, basket, admin and location responses stay network-only. Bump cache
version when asset strategy changes. Voice-first means voice is an option, not
a gate: every task has readable, tappable text fallback, large phone/code
controls, one-time-code autofill, listen/read-aloud option, and consent before
recording.

The product maps are planned for Leaflet/OpenStreetMap, browser permission and
external map links. The existing marketing landing page has its own
illustrative Google Map loader; that is not the dispatch/location service.
Never present expansion overlays as current business activity.

## Local commands and implementation status

```sh
npm ci
npm run dev
npm test
npm run build
npx tsc --noEmit
```

The current app includes guest discovery and tracking, merchant shop/catalogue
management, voice product drafts, paid-order preparation, ledger-backed
earnings, rider delivery workflows, and an admin workspace. Merchant navigation
follows the five-tab Dashboard, Shop, Voice Orders, Earnings and Profile
architecture. The merchant dashboard loads a consolidated owner-scoped summary
every 30 seconds; merchants can control accepting-orders state and weekly
opening hours. Closed shops remain discoverable but cannot add products or
create a basket, with checkout enforcement on the server. Only the safe Ready
transition may be queued in account-scoped IndexedDB and replayed online;
refunds, rejection, and money actions remain online-only. Push delivery and
media upload still require server integrations and configured provider
credentials. The API remains authoritative for availability, ownership, order
state, and balances.
