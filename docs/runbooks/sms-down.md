# SMS outage

**Status: partial.** OTP sends use BlessedTexts first and VasPro as failover in
the `prod` and `sandbox` profiles. The `dev` profile deliberately has no SMS
sender. This does not include delivery receipts, an SMS spend cap, or the
notification outbox/retry worker.

If OTP delivery fails, the adapter returns a generic unavailable response after
both provider requests fail. Check provider status and credentials out of band,
confirm the sender ID is approved on each provider, and escalate to the
respective SMS provider. Never copy API keys or OTP values into incident logs.
Provider failover covers a rejected or errored primary request; it does not
confirm handset delivery.

The backend logs the primary provider's numeric rejection code or HTTP status,
and the fallback provider's HTTP status or transport exception type. Use these
safe diagnostics with the corresponding provider dashboard to check credentials,
sender-ID approval, account balance and recipient delivery; logs never include
the OTP, recipient phone, API key or raw provider response body.
