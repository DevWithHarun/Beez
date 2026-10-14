# Fees

**Status: delivery fee and rider delivery-fee split approved for the sandbox
pilot; merchandise commission and transfer-charge treatment remain open.**
The delivery fee uses the architecture's worked-example formula
`base + per_extra_stop × (stops - 1) + per_km × ceil(max(0, km - free_km))`.
The approved values are KES 100 base, KES 40 per additional shop, 3 km free
and KES 20 per additional km. They are backend configuration defaults, not
client-side prices. After customer-confirmed delivery, 95% of the charged
delivery fee is credited to the assigned rider and 5% to platform revenue;
the platform share is rounded to the nearest KES. This split is separate from
the merchandise commission. Current checkout estimates distance as a
straight-line route.

Before production, decide merchandise commission base/rounding and per-category
exceptions; delivery routing source, rounding and minimum; stop count rules
for rejected parts; customer-visible fee timing; refunds/recalculation; tax
and provider charges; who pays withdrawal transfer fee; configuration owner
and effective-date behavior for an in-progress basket. Backend Basket is the
only fee calculator; client quotes display its response.
