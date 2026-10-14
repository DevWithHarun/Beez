# Service zones

**Status: open.** The product invariant is firm: shops in one basket must be
inside the same active market/neighbourhood zone. The current schema stores a
centre and radius, and checkout rejects delivery pins outside that radius.
There are no seeded/active zones or provisioning UI, so public browsing and
checkout have no available service area until one is configured. The final
zone shape, ownership and rollout are undecided. Do not infer production
coverage from example coordinates or map overlays.

Decide boundary representation, overlaps, whether delivery pin and every shop
must be inside zone, zone discovery/default, inactive-zone behavior for
existing baskets, radius/distance source, who may edit, audit/versioning and
how orders behave when a zone changes. Record map/data source, owner,
effective date and representative edge-case tests before enabling checkout.
