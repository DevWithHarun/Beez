# Maps and location

The product target is Leaflet/OpenStreetMap for low data use, optional browser
geolocation, and external map links for rider stop navigation. Ask permission
only at the point location is needed; explain purpose and allow landmark/manual
entry fallback. Merchant/shop and destination coordinates are validated by the
backend and exposed only to authorized actors.

Rider app sends location about every 15 seconds only while the rider is
available and app is open. Dispatch treats location older than two minutes as
stale. Customer Track sees rounded rider location only during ON_THE_WAY;
never cache precise/private location. Stop pickup/drop-off records are
business events, not an always-on location feed.

The existing marketing Vision section uses Google Maps with illustrative
expansion markers. It is separate from product dispatch and must keep those
markers explicitly labeled as targets, never live business activity.
