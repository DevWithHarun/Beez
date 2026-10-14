# Voice interaction

Voice is an optional low-literacy path, never a requirement. Merchant records
Opus with browser `MediaRecorder` (max 60 seconds, level meter and language
hint), reviews upload consent, and uploads directly to private object storage
through a short-lived signed URL. Provide accessible recording state,
playback/read-aloud and typing/helper fallback if recognition fails twice.

The backend SpeechToText → ProductExtractor pipeline produces draft rows with
name, optional unit, integer KES price, confidence and unparsed phrases.
Display/read back results; merchant can edit/delete and must tap Publish.
Nothing goes live before confirmation. Never present LLM output as verified
without user review.

Retain audio/transcripts only with explicit consent, provide deletion on
request, cap recordings/provider cost, and send no raw audio or phone data to
analytics. Quality is measured by edits, deleted rows and confirmation time on
a consented Swahili/English/mixed test set of at least 50 recordings.
