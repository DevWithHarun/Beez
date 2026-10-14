# TanStack Start routes

Routes are transport/composition only: select a feature screen and preserve
the shared API, auth and error boundaries. Do not implement prices, money,
ownership or business transitions in route components.

`__root.tsx` owns document metadata, error boundary, query provider, PWA
manifest reference and static-only service-worker registration. `index.tsx`
currently owns the public landing experience and hash routes. Preserve retired
`#/trust` and `#/built-on` redirects to Features.

Target route map: first-time launch/Discover; public `/m/{slug}` shop links;
capability-scoped `/track/{token}`; merchant `/sell/**`; approved rider
`/ride/**`; `/auth/**`; and a separately lazy/guarded `/admin/**` group.
Direct shop and tracking links work without the four-tab bar. Admin is not a
launch tab.

TanStack Start uses file-based routing; generated `routeTree.gen.ts` must not
be hand-edited. Add route-match/role/deep-link tests with each route. UI guards
do not replace backend authorization; API access is checked on every request.
