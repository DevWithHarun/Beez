# Merchant onboarding

Create the merchant profile after phone OTP: business/shop name, category,
zone, location/landmark, registered payout phone, and optional intro video.
Persist resumable onboarding state server-side; ACTIVE/approved status is
required before the shop appears publicly. Approval/rejection is an audited
Admin workflow. Never ask a merchant to buy from their own shop. Product setup
supports voice drafts and a full typing fallback; no extracted item is public
until the merchant confirms it. See Auth, Catalogue and Voice backend
contracts.
