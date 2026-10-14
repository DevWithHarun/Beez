# Product feature boundaries

The app is one installable PWA with four launch tabs—Discover and Track are
guest-friendly; Sell is merchant-only; Ride is for approved riders. Admin is a
separate `/admin` route group/bundle. Each feature owns its screens, local
view-state and feature-specific tests. Cross-feature requests go through typed
`shared/api` contracts and backend service boundaries, never imports into
another feature's internals.

The purchase is a server-driven journey:
Discover adds items across shops in one zone → Checkout creates one
server-priced basket and one payment → Track follows each vendor part and one
delivery → Sell handles each merchant's own part → Ride accepts one multi-stop
delivery → successful delivery posts wallet earnings. Requests, role rules,
state transitions and `*Kes`/error conventions live in
[`../../../docs/architecture-map.md`](../../../docs/architecture-map.md).

These folders are implementation boundaries, not completed product features.
Build a vertical slice only after its backend contract, decision dependencies,
privacy/security controls and acceptance tests are agreed.
