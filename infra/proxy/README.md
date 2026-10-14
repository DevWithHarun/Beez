# Edge and reverse proxy

Production edge must terminate TLS, apply WAF and IP rate limits, route PWA/API
to healthy stateless backend instances, and protect callback endpoints.
Cloudflare or Caddy is the architecture option; hosting, TLS termination,
forwarded-header trust and CDN cache policy are not yet decided.

Before adding config, define health/readiness probes, request/body/time limits,
trusted proxy chain, `X-Request-ID`, client IP derivation, CSP/HSTS,
`/api/v1` no-store behavior, public static asset caching, and no caching of
auth, tracking capability, order or location data. M-Pesa/SMS webhook secret
paths must not be logged. Validate config and test bad TLS, host/header
spoofing, cache keys and rate-limit behavior. No active proxy config exists.
