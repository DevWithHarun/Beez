# Merchant shop profile

Edit the merchant's own public shop name/slug, category, description,
zone/location/landmark, map point and intro video. Public links use `/m/{slug}`.
Video uploads use a short-lived signed private-storage URL and server-side
confirm step; validate size/type/duration and never expose storage credentials.
An unapproved/suspended shop is not discoverable. Do not change the live shop
slug silently without a redirect/decision. Coordinates are purpose-limited and
do not enable a public live-location feed.
