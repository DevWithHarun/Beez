# Merchant home

Show the signed-in merchant's own shop status, onboarding/approval next step,
new/ready order counts, attention badge, product/stock shortcut and earnings
summary. Each tile is an owned route action, not a source of business truth.
Counts and balances come from the API; provide explicit loading, empty, offline
and retry states. Never show another merchant's aggregate data. Withdraw is a
shared Wallet action.
