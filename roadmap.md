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
- [ ] Report confirmed payments separately from unpaid orders.
- [ ] Verify available flows and access rules.
- [ ] Enable live M-Pesa processing (requires payment-provider credentials and setup).
- [ ] Verify signed-in admin operations (external Supabase session unavailable to automated checks).
