# App shell and navigation

The target PWA has one launch shell and a bottom bar with Discover, Track, Sell
and Ride. Admin `/admin` is a separate guarded/lazy route group, not a tab.
First visit opens Discover; remember the last tab locally. `/m/{slug}` and
`/track/{token}` open directly without the tab bar. Signed-out Sell/Ride show
role-specific sign-in explanation. Each tab is lazy-loaded and derives badges
from server state.

`router.tsx` delegates to `app/router.tsx`, which wires TanStack route tree and
QueryClient context. `main.tsx` exports the same router factory for the planned
client entry; TanStack Start currently owns the runtime entry. `LaunchShell.tsx`
is a non-functional visual scaffold, not a route or implementation of tab
flows.

The root/index TanStack route renders the marketing landing page and its
existing hash navigation. The customer Discover flow is on `/discover`, and
public shop links use `/m/{slug}` without the app tab bar. Keep the marketing
landing URLs and retired `#/trust`/`#/built-on` redirects intact.

Merchant and rider onboarding stays in the branded `/app` flow. After profile
setup or a later sign-in, merchants go to `/merchant` and riders to `/rider`.
These authenticated workspaces have role-specific navigation and do not render
the public onboarding artwork or shared customer tab bar. Merchants can manage
their shop/products, view paid orders, mark paid orders ready for pickup, and
see confirmed merchandise totals (delivery fees excluded). Refund/rejection,
rider dispatch/delivery and earnings payouts remain unavailable until those
workflows are implemented. Direct workspace visits require a valid role
session.

The service worker is static-public-asset-only. It must bypass navigation and
all private/API/auth/admin/wallet/order/capability/location responses. The
manifest and icon describe the PWA install surface. Registration errors are
logged; feature data must remain online and server-authoritative.
