# Phone-size end-to-end journeys

Use Playwright at a phone viewport against the local app and test backend,
with fake SMS, mocked Daraja and deterministic catalogue/rider fixtures. These
journey files currently only mark planned scope; they are not executable tests
until the corresponding application flows exist. Do not call production
providers or use real customer/financial data in E2E.

| Spec | Journey and acceptance boundary |
| --- | --- |
| `onboard-merchant-by-voice.spec.ts` | Choose language, phone OTP, merchant onboarding, record/transcribe a fixture, edit and confirm product drafts; ensure nothing publishes before confirmation |
| `multi-shop-basket.spec.ts` | Browse same-zone shops, add multiple vendors, server quote, one mocked STK payment, per-shop Track timeline; reject cross-zone basket and show item/part refund path |
| `rider-delivery.spec.ts` | Approved rider goes available, first-win multi-stop job, pickup each valid stop, customer-only code, delivered status and earnings event |
| `withdrawal-and-payout.spec.ts` | User confirms withdrawal with SMS, hold appears, admin MFA/manual payout reference, audit row and paid state; rejection returns hold |

All journeys must assert role/ownership separation, accessible phone-size
controls, error/retry/idempotency paths and no sensitive data in caches.
Architecture section 18 defines unit/integration/contract/security/invariant,
load and field test layers beyond E2E.
