# Rider M-Pesa payouts

Rider Wallet payouts use Safaricom Daraja B2C. The rider payout endpoint is an authenticated Edge Function; its OAuth credentials and security credential stay in Supabase Function secrets. Safaricom result and timeout callbacks are correlated to a payout request before the payout status is changed.

## Supabase Auth SMS delivery

The `send-sms-hook` Edge Function accepts Supabase's signed Send SMS Auth Hook payload and forwards the generated OTP to BlessedTexts. Deploy it independently from the frontend:

```sh
supabase functions deploy send-sms-hook --no-verify-jwt
```

Configure these Edge Function secrets in the Supabase project:

- `SEND_SMS_HOOK_SECRETS`: the full `v1,whsec_...` secret generated for the HTTP Send SMS Auth Hook
- `SMS_API_KEY`: BlessedTexts API key
- `SMS_SENDER_ID`: sender ID approved by BlessedTexts
- `SMS_PRIMARY_API_URL`: optional; defaults to the BlessedTexts sendsms endpoint
- `SMS_FALLBACK_API_URL`: optional; configures the VasPro fallback endpoint
- `SMS_CALLBACK_URL`: optional; callback URL passed to the fallback provider

Then set the Auth Hook HTTPS endpoint to `https://<project-ref>.supabase.co/functions/v1/send-sms-hook` and use the same `SEND_SMS_HOOK_SECRETS` value as the hook secret. Do not put these secrets in `VITE_` variables or expose them to the browser. Local `.env` values are not automatically available to deployed Edge Functions.

The function returns HTTP 200 only when BlessedTexts reports `status_code` `1000` or the configured fallback accepts the request with HTTP 2xx. Invalid requests or provider failures return an error so Supabase does not report a successful send when both providers reject the SMS. Check Edge Function logs for failures and provider delivery reports for handset delivery status.

## Merchant voice product creation

The merchant Product tab offers an optional voice workflow while retaining manual product entry. The `voice-product` Edge Function requires a signed-in merchant and checks merchant ownership before processing. It uses OpenAI Whisper (`whisper-1`) for English/Kiswahili transcription and `gpt-4o-mini` with a strict JSON schema for product extraction and draft corrections. Its only supported product fields are name, category, price in KES, and stock. It does not publish products or perform database writes.

Apply the rate-limit migration, configure the OpenAI API key only as a Supabase Edge Function secret, then deploy:

```sh
npx supabase db push
npx supabase secrets set OPENAI_API_KEY=your-openai-api-key
npx supabase functions deploy voice-product
```

Do not put the key in frontend variables, `.env`, source control, or chat. The function uses Supabase runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` for merchant authentication and a database-backed limit of 30 voice requests per merchant per hour. Signed-in merchants can record up to 60 seconds in the browser; requests are limited to 10 MB. The browser's speech synthesis reads details aloud when supported. TTS quality and Kiswahili voice availability depend on the merchant's browser and installed voices; on-screen review remains available.

AI image generation is not configured. Merchants may upload an actual product photo during review or skip the photo. The existing product image storage bucket and policies are used on explicit publication. Products are saved through the existing authenticated `saveMerchantProduct` function only after the merchant confirms publication.

For local development, set `OPENAI_API_KEY` as a Supabase Function secret in the linked project and run the Edge Function with the Supabase CLI. Automated frontend tests mock Supabase; they do not call OpenAI. Audio and transcripts are not logged or persisted by this function.

## Required setup

1. Apply the database migration:

   ```sh
   supabase db push
   ```

2. Configure these secrets for the Supabase project using the Supabase Dashboard's Edge Function secrets page:

   - `DARAJA_ENVIRONMENT`: `sandbox` or `production`
   - `DARAJA_CONSUMER_KEY`
   - `DARAJA_CONSUMER_SECRET`
   - `DARAJA_SHORTCODE`
   - `DARAJA_INITIATOR_NAME`
   - `DARAJA_SECURITY_CREDENTIAL`: Safaricom-encrypted initiator credential for the selected environment
   - `DARAJA_CALLBACK_TOKEN`: a long, randomly generated secret used to authenticate Safaricom callbacks
   - `DARAJA_COMMAND_ID`: optional Daraja B2C command; defaults to `BusinessPayment`

   The functions also use Supabase's `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` runtime secrets. Never put Daraja credentials in browser variables, source control, or chat.

3. Deploy both functions:

   ```sh
   supabase functions deploy rider-mpesa-payout
   supabase functions deploy rider-mpesa-callback
   ```

4. Ensure the deployed Edge Function URL is publicly reachable over HTTPS. The payout function supplies these result and queue-timeout callback URLs to Daraja for each B2C request:

   ```text
   https://<project-ref>.supabase.co/functions/v1/rider-mpesa-callback?token=<DARAJA_CALLBACK_TOKEN>&type=result
   https://<project-ref>.supabase.co/functions/v1/rider-mpesa-callback?token=<DARAJA_CALLBACK_TOKEN>&type=timeout
   ```

   Keep the callback token private. The callback function intentionally disables Supabase JWT verification because Safaricom does not send a Supabase user token; it authenticates callbacks with this token and matches provider conversation references to the payout row.

5. Verify end-to-end in the Safaricom sandbox before using production credentials. Production use requires a Daraja production app, B2C-enabled shortcode, valid initiator/security credential, and configured funds/limits.

Payout requests are reserved against delivered rider earnings. A callback with a successful result and transaction ID marks a payout `Paid`; a definitive provider failure marks it `Failed`. A timeout or ambiguous provider response remains reserved as `Review` so the rider cannot accidentally request the same funds again before reconciliation. Each request is capped at KES 250,000.
