# Discover and Track
## Merchant dashboard backend
- [x] Replace merchant mock figures with owner-scoped saved records.
- [x] Save merchant setup, product changes and order preparation actions.
- [ ] Verify real-record calculations, persistence and access restrictions.

- [x] Build reference-matched marketplace, product, cart and checkout screens.
- [x] Build order list, details, progress, map and delivery confirmation screens.
- [x] Connect Discover and Track while keeping Sell and Delivery inactive.
- [x] Verify both demonstration flows.

# Admin & sign-in
- [x] Finish admin pages (orders, customers, merchants, products, riders, deliveries, payments, reports, support, settings).
- [x] Admin signs in with email + password; merchants and riders with phone + SMS code.
- [ ] Phone codes need an SMS provider enabled in Supabase (blocked on user).

# Admin finalisation
- [ ] Harden admin provisioning, private orders and rider actions.
- [ ] Complete merchant/product editing, rider approval, delivery assignment and account settings.
- [ ] Connect the storefront and checkout to saved products and orders.
- [x] Report confirmed payments separately from unpaid orders.
- [ ] Verify available flows and access rules.
- [ ] Enable live M-Pesa processing (requires payment-provider credentials and setup).
- [ ] Verify signed-in admin operations (external Supabase session unavailable to automated checks).

# Beez blueprint, phase 1: voice order assistant
- [x] New-order alert for merchants with spoken message and 2-minute server countdown
- [x] Accept or decline by voice (English and Kiswahili) or by tapping, confirmed by the server
- [x] Orders expire (never auto-accepted) when the merchant doesn't respond; riders can't take unanswered orders
- [x] Action history saved for every accept, decline and expiry
- [ ] Verify the assistant signed in as a real merchant (automated sign-in unavailable for this backend)
- [ ] Later phases (not started): AI product photos, guest shopping on real products, Reels, WhatsApp, SMS alerts, M-Pesa ledger

# Beez blueprint, phase 2: AI product photo studio (Section 5)
- [x] Fix the voice product helper's error-message bug
- [x] Merchant takes a photo; Beez suggests name, category and description from it
- [x] Create Enhanced, Clean studio and Promotional versions; merchant can ask for changes (typed or spoken)
- [x] Beez explains the options aloud; merchant picks one and publishes
- [x] Keep original, every AI version, history, approval and photo-vs-AI label for each image
- [x] Customers see an "AI-styled image" label on promotional pictures
- [ ] Apply the new saved-data changes (this copy of the app is not linked to its backend — blocked on user reconnecting it)
- [ ] Verify the studio signed in as a real merchant (blocked on the backend link above)
- [ ] Next phase: guest shopping & cart without sign-in (Section 6)

# Product Reel & merchant intro video
- [x] Saved-data changes: shop slugs, open/closed, intro video fields, reel_events, review list
- [ ] Merchant video page (/m/video): tips, record 15–30s, preview, resumable upload, thumbnail, gallery upload, save-for-later
- [ ] My Store card (record/upload/preview/replace/delete/status) + shop open toggle + "add a photo" nudge
- [ ] Customer intro player (/shop/[slug]/intro)
- [ ] Shop page (/shop/[slug]) with Play and Browse products
- [ ] Reel feed logic (open shops, photo required, distance+newness mix, max 2 in a row per shop, 10 per page) — tested
- [ ] Reel page (/reel, /shop/[slug]/reel, ?p= deep link): swipe, add/stepper, share, visit shop, checkout bar, one-shop rule
- [ ] Live sold-out / shop-closed, low-data mode, offline/empty/end/error states
- [ ] reel_events logging + admin Reel & videos page
- [x] Video storage folder created

# Checkout
- [x] One-page checkout on the Discover background, no bottom nav: basket, delivery/pickup, contact, payment, sticky Place order
- [x] Save rider notes with the order and show them to the rider
- [x] Live M-Pesa payment prompt: PIN prompt after ordering, live status, send again, change number, pay cash instead, late payments refunded
- [x] Orders saved only by the server (no self-set prices or paid status)
- [x] Safaricom keys saved (live mode; Safaricom sign-in confirmed)
- [ ] Publish so Safaricom's confirmations and receipt numbers reach the app (waiting on user)
- [ ] Verify a real payment end to end (needs a signed-in shopper and a real phone; automated sign-in unavailable)
- [x] Guest checkout: no sign-in needed; a private guest session is created when the order is placed (verified with a test cash order)
- [x] Rider wallet payouts sent from the app with a Safaricom-accepted address (old payout functions no longer used)
- [ ] Rider payouts need Safaricom payout details: shortcode, initiator name, security credential (waiting on user)
- [ ] Remove the old payout functions from the backend after publishing and checking payouts (waiting on publish)

# Merchant Analytics tab
- [x] Fix the build error in the new sales calculations
- [x] Rebuild the Analytics tab: period picker, compared totals, customers, payments, delivery/pickup, busiest hour, product photos, low stock, download
- [x] Checks for sales rules (unpaid and cancelled excluded, delivery fees left out)
- [ ] See the tab signed in as a real merchant (automated sign-in unavailable for this backend)

# Reel videos with admin approval
- [x] Saved-data changes written: product clips, review status, approval history, hide from reel, reel order
- [x] Customer reel: approved videos only, video products first, photo slides labelled; intros need approval
- [x] Recorder (8–15s product clips), upload-later when offline, Videos section, admin review queue
- [x] Videos section shown in the merchant dashboard; "Add reel video" button on each product
- [x] Checks for the reel video rules; leftover test page removed
- [x] Apply the saved-data changes (applied after the backend was reconnected)
- [x] Video storage folder created (public viewing, merchants upload only into their own folder, 50 MB limit)
- [ ] Verify the Videos section and admin queue signed in (automated sign-in unavailable for this backend)
- [x] Text merchants when a video is approved (now live) or rejected, through the existing SMS provider
- [x] SMS sender keys saved for the app's server

# Live tracking & delivery (brief: live tracking + rider dashboard)
## Phase 1 — live tracking
- [x] Rider phone shares location every 4s while online (impossible jumps dropped, checked again by the server); screen kept on during deliveries
- [x] Customer tracking page: full-screen dark map, shop/home pins, road route, gliding rotating rider icon
- [x] Tracking sheet: stage headline, live GPS indicator, arrival countdown, 5-step progress, rider call/text, pickup and landmark drop-off
- [x] Fix: single-order tracking link opened the order list instead
- [ ] Test with a real rider phone and a real customer order (automated sign-in unavailable for this backend)
## Phase 2 — dispatch, handover, wallet
- [x] Nearby jobs (3 km, only after the shop accepts, one-rider-wins) — saved-data side live
- [x] Payout ledger recorded once per delivered order; rider contact for shopper and shop; vehicle/plate/shift fields
- [x] Rider scanner: camera QR + type-the-4-digit backup, checked by the server
- [x] Pickup QR pop-up on the shop's orders list; delivery QR on the customer's tracking page
- [x] Job offers with 45s countdown, chime and vibration
- [x] Rider Home, Delivery, Wallet (ledger), Today (timeline) screens + bottom tabs on phones
- [x] Vehicle type and number plate on the rider profile
- [x] Save scans offline and send them when signal returns
- [x] Checks for offer, wallet, timeline and offline-scan rules
- [ ] Automatic M-Pesa sending on each delivery (needs Safaricom payout details — waiting on user)
- [ ] Try a full delivery signed in as a real rider, shop and customer (automated sign-in unavailable for this backend)
