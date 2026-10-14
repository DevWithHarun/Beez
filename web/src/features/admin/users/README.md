# Account administration

Search merchants/riders with role, onboarding/active/suspended status and
last-seen summary. Sensitive phone/payout/ID details are masked and
least-privilege. Actions suspend, restore and logout-all via Auth/service
interfaces, with a reason, fresh MFA and audit event. Suspension increments
token version/revokes sessions and prevents public shop or rider-job access.
Never change roles by editing the user row directly.
