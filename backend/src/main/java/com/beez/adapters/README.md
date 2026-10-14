# Provider adapters

Concrete third-party clients are isolated here; the business module owns the
port and decides retry, transaction and failure semantics. Configuration
selects implementations without leaking provider SDKs into business packages.
Never make a provider call inside an open ledger/order transaction unless the
architecture explicitly describes an asynchronous outbox/callback boundary.
Use timeouts, bounded retries, idempotency and contract fixtures; redact
credentials and personal data from logs. Confirm current official provider
requirements before coding.

| Adapter folder | Port/consumer | Responsibility |
| --- | --- | --- |
| `mpesa/` | Payment `PaymentProvider`; Wallet later | Daraja OAuth, STK Push, query/callback validation; B2C only after approval |
| `africastalking/` | Notification SMS/voice, Auth `SmsSender` | OTP/order/withdrawal messages and voice-code fallback |
| `webpush/` | Notification channel | VAPID push, expiry/unsubscribe and acknowledgment |
| `voice/` | Voice `SpeechToText` and `ProductExtractor` | OpenAI transcription and strict-schema product extraction |
| `storage/` | Catalogue/Voice storage port | Private S3-compatible objects and scoped signed upload/download URLs |

These directories are boundaries only; no provider implementation or secret is
configured.
