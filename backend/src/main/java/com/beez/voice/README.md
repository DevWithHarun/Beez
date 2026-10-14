# Voice module

Voice supports merchant onboarding and later product maintenance; it creates
**drafts**, never live products. The merchant remains responsible for review
and confirmation before the Catalogue service publishes anything.

1. Merchant selects English or Swahili, agrees that the audio will be sent to
   Beez and OpenAI for processing, and records up to 60 seconds in the browser.
2. The authenticated merchant endpoint accepts at most 10 MB and 10 requests /
   50 MB per hour per account. Audio is held in memory for the request and is
   not persisted by Beez.
3. `OpenAiSpeechToText` transcribes the recording. `OpenAiProductExtractor`
   returns strict-schema drafts with product name, optional unit, integer KES
   price, confidence, source phrase, and unparsed phrases.
4. The service validates bounds, normalizes units, merges duplicate names and
   flags uncertain/unparsed details. Provider errors are sanitized.
5. The merchant reviews, edits, and removes every draft. Explicit confirmation
   sends the selected products to an atomic Catalogue batch endpoint. Nothing
   is published before confirmation.
6. Manual product entry remains available if recording, recognition, or
   extraction fails.

Configure `OPENAI_API_KEY` through the deployment secret manager. Optional
`OPENAI_BASE_URL`, `OPENAI_TRANSCRIPTION_MODEL`, and `OPENAI_PRODUCT_MODEL`
settings select the API endpoint and models. The service fails closed when the
key is absent. Never log credentials, audio, or transcripts. Review OpenAI's
current data handling and retention terms for the production account before
launch.

The browser submits only the selected microphone recording; the backend does
not store audio or transcripts. Usage is counted per merchant in PostgreSQL
and old hourly counters are pruned during voice requests. Maintain a
consented Swahili/English/mixed-language evaluation set and track edits,
deletions, and confirmation rates before changing models.
