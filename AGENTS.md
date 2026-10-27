## Project layout

- The app lives at the repository root (no subfolder, no `lovable.toml` run overrides) — the publish build installs from the root `package.json` and ignores run overrides.
- Merchant private screens live under the authenticated layout; authenticated server functions and owner-scoped RLS enforce access independently of the UI.
- Merchant summaries derive from persisted orders and order items, using Nairobi calendar periods and confirmed product revenue; no seed data or fallback business totals.
- Merchant preparation uses a narrowly scoped database function; merchants cannot change payment confirmations or delivery status directly.
