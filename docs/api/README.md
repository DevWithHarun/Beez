# API contract ownership

REST/JSON v1 is rooted at `/api/v1`; module APIs are owned by the corresponding
backend module and exposed through its controller/service boundary. The route
catalogue in [`production-architecture.html`](../production-architecture.html)
section 13 is the agreed design input. [`openapi.yaml`](./openapi.yaml)
documents authentication in detail; it is maintained with the controllers
and is not generated automatically yet.

## Contract conventions

- Error body: `{ "error": "code", "message": "...", "details": {}, "requestId": "..." }`.
- Cursor pagination for collections.
- Integer whole KES for money; property names end in `Kes`.
- Mutations that can be retried accept `Idempotency-Key`.
- Public/guest basket endpoints are rate limited; all other endpoints have
  explicit actor, status and ownership scopes.
- Cross-account resources resolve as 404. Admin changes are audited.
- M-Pesa/SMS webhooks require HTTPS, secret path and provider verification;
  payment callbacks are idempotent and do not trust callback bodies alone.
- Authentication responses/capability data use no-store. Basket tokens grant
  access to one basket only.

## Endpoint ownership

| API group | Owning module | Main purpose |
| --- | --- | --- |
| `/public/zones`, `/public/shops`, `/public/m/{slug}` | Catalogue | Guest service-zone discovery and shop pages |
| `/public/baskets/**` | Basket | Create/quote, pay intent, track and missing-item decision |
| `/auth/**`, `/push/**` | Auth | OTP/admin sign-in, refresh/logout, current user, subscriptions |
| `/merchants/**`, `/products/**`, `/vendor-orders/**` | Catalogue/Basket | Own shop/products/order part |
| `/voice-products/**` | Voice | Create draft and merchant-confirm extraction |
| `/riders/**`, `/deliveries/**` | Dispatch | Rider status, availability, jobs/stops/delivery and earnings summary/history |
| `/merchants/me/earnings/**` | Wallet | Merchant's own earnings, history and withdrawal lifecycle |
| `/admin/**` | Admin facade, services owned by domain modules | Approval/ops/manual actions |
| `/webhooks/mpesa/**`, `/webhooks/sms/**` | Payment/Notification | Provider callbacks |

OTP request/verify, refresh, logout/logout-all and current-user, public
Catalogue, merchant shop/product, and guest basket create/track routes have
controllers. Payment-start is present but intentionally unavailable until a
Daraja integration and verified reconciliation flow are implemented. Rider
withdrawals, Admin and webhook route groups remain planned. Keep this inventory,
the owning module README, OpenAPI contract, security tests and web client types
aligned when an endpoint contract changes.
