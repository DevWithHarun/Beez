# Edge Functions

Rider Wallet payouts no longer run here: they are the app's `requestRiderPayout` server function, and Safaricom posts results to `/api/public/payouts/rider/{result|timeout}/{key}` (no "mpesa" in the address, which Safaricom rejects).

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
