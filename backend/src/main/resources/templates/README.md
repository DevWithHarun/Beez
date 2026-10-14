# SMS and notification templates

Keep short, reviewed English (`en`) and Swahili (`sw`) templates keyed by
business event and channel. Initial events: login/withdrawal OTP, customer
payment receipt with tracking link and delivery code, shop paid-order alert,
ready/late/rejected/assigned/pickup/on-way/delivered, rider/admin approval,
withdrawal requested/paid/rejected, account security alert.

Templates must use masked/context-safe fields, never full phone numbers or
secrets except the one-time code the message exists to deliver. Do not put
capability tokens in analytics; tracking link is a bearer capability and must
be random, scoped and no-referrer/no-store. Keep placeholders validated and
message length/cost measured. Quiet hours do not delay urgent order alerts.
Translations require human review; no templates or send pipeline are
implemented.
