# Browser session and route guards

`session.ts` holds access JWT and minimal user/role state in memory only.
Refresh credential is an HttpOnly; SameSite=Lax cookie scoped by backend
(Secure outside local development); browser JS must never read or copy it.
`auth/` guards improve navigation but are not authorization—the API checks
role, account status, rider approval and record ownership on every request.

`refreshSession()` coalesces concurrent refresh calls, includes credentials
and `X-Beez-Client: pwa`, disables caching and validates the returned session.
The backend requires an allow-listed Origin. Logout revokes the family
server-side; logout-all/token-version change invalidates existing access JWTs.

Guests have no account. A customer tracking capability grants access to one
basket, is stored hashed on the server, and is not an auth session. Never store
it in analytics, logs or service-worker caches. Role conflict (one phone,
one role) must be a clear sign-in response.
