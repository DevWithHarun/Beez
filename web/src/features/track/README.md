# Track tab

**Actor:** guest/customer. Deep link `/track/{token}` opens a single basket
without requiring an account or showing the tab bar. Device-local recent
capability links may populate Track; never sync bearer tokens as public
analytics or expose them to referrers.

Show one basket timeline and per-shop vendor-order progress (paid/preparing,
ready, picked up), then the one rider/delivery progress. Display the four-digit
delivery code only to the authorized customer and only after payment.
Phone numbers belonging to others are masked. Pending/unpaid, partial-refund,
failed-delivery and expiry states need explicit copy.

Use capability access scoped to one order, hashed server-side; no-store API
responses and no service-worker cache. Poll every 10 seconds; show rounded rider
location only while ON_THE_WAY. SSE can replace transport later without
changing the API/domain contract. Tracking is server status, not simulated
activity. No live feed is connected yet.
