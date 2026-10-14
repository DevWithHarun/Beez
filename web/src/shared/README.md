# Shared client modules

This is the small set of reusable browser capabilities. Feature-specific
business behavior remains under `features/`; this folder does not become a
second domain layer.

| Package | Responsibility | Safety boundary |
| --- | --- | --- |
| `api/` | Typed `/api/v1` client, request IDs, structured errors, cursor paging, idempotency headers | Server owns every total/state; never cache private replies |
| `auth/` | Memory-only access token, role/session context, guards, single-flight refresh | Refresh cookie is HttpOnly; no credentials in Web Storage |
| `i18n/` | English/Swahili text and user's local language preference | Review translation and low-literacy phrasing |
| `ui/` | Accessible buttons, large tiles, bottom bar, sheets, toast patterns | Keyboard/touch, focus and screen-reader behavior |
| `voice/` | MediaRecorder, playback/read-aloud, waveform | Consent, bounded recording and typing fallback |
| `maps/` | Browser geolocation permission, Leaflet/OSM, external map links | No location collection until needed/consented; do not imply illustrative targets are live |
| `push/` | Subscribe/unsubscribe and current-device subscription | Remove on logout/account switch |
| `utils/` | Display-only money, Kenyan phone and date formatting | Never use client formatting as validation/calculation |

Cross-cutting flow: feature calls typed API; API attaches token/idempotency and
normalizes errors; backend checks auth, ownership and state; shared UI displays
the committed response. Keep authorization on the server even when a role
guard hides the screen.
