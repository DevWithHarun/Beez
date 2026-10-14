# Dispatch module

**Owns:** rider profile/approval status, availability, privacy-sensitive
location, delivery, ordered shop stops, job offers/claims, delivery
confirmation and tracking. One basket gets exactly one delivery and one stop
for every active vendor order. Customer drop-off is always last.

An approved rider toggles AVAILABLE/OFFLINE. When every active vendor order
is READY or rejected, one delivery is created for the basket. Approved riders
can see the queue; only an online rider may claim. First claim wins using one
atomic conditional update; zero updated rows means the job was taken.

The rider workspace shows each sequential shop pickup with call details and
the customer drop-off coordinates/landmark. The rider confirms each pickup;
after all stops, status becomes ON_THE_WAY.

Generate a six-digit code at payment initiation, keep only its HMAC on the
backend, and show it to the customer in the checkout response and session-only
tracking view. Allow at most five wrong attempts, then lock the delivery code.
Successful code verification marks eligible vendor orders and the basket
delivered/completed and credits merchant earnings through Wallet. Live rider
location, failed-delivery recovery and customer tracking remain unimplemented.
The same successful confirmation atomically credits 95% of the basket's
delivery fee to the assigned rider and 5% to Beez platform revenue. Rider
earnings are available from the rider's own Wallet summary and history; rider
withdrawals are not implemented.

Rider approval is currently controlled by Beez operations through the separate
admin identity boundary. The admin console can approve pending riders after
fresh authenticator verification; rejection and additional application-review
workflows remain unimplemented.
