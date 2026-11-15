# Beez — application architecture

## Product summary

Beez is a marketplace and operations app for customers, merchants, riders, and administrators. It is built around Kenyan commerce workflows: product discovery, merchant and rider workspaces, order management, phone-based sign-in, and rider M-Pesa payouts.

This document describes the architecture present in this repository. It is not the proposed Java/Spring design in the workspace-level `prompt.md`: Beez currently uses a TypeScript/TanStack application and Supabase services. Do not treat proposed components such as Spring Boot, Redis, or a separate S3 service as deployed parts of this app.

## Roles and application surfaces

| Role | Main surfaces | Responsibilities |
|---|---|---|
| Customer | `/`, `/discover`, `/groceries`, `/product/$id`, `/cart`, `/checkout`, `/payment`, `/order-confirmed/$id`, `/track/$id` | Browse the active catalog, place an authenticated order, and view order details and tracking. |
| Merchant | `/onboarding/merchant`, `/merchant/dashboard` | Maintain a business profile and products, process orders, view campaigns and redemptions, and request payouts. Product creation supports manual entry and a voice-assisted draft workflow. |
| Rider | `/onboarding/rider`, `/rider/dashboard` | Maintain a rider profile, set availability, view and advance assigned deliveries, update location, and request M-Pesa payouts. |
| Administrator | `/admin/*` | Manage marketplace operations, users and roles, orders, products, support tickets, and reporting. Admin access depends on an administrator role in the database. |
| Signed-out visitor | `/login`, `/get-started` and public catalog pages | Discover the service and authenticate or begin onboarding. Checkout/order creation requires authentication. |

Routes are defined in `src/routes/` and use TanStack Router file-based routing. The generated route tree is maintained by the router tooling.

## Architecture at a glance

```text
Browser
  React 19 UI + TanStack Router/Start + React Query
       |                         |
       | Supabase browser client | authenticated TanStack server functions
       +------------+------------+
                    |
        Supabase Auth / Postgres / Storage / Realtime
                    |
       Supabase Edge Functions (Deno)
          | SMS provider | OpenAI | Safaricom Daraja

TanStack Start server entry
  SSR and server functions, built with Vite/Nitro
```

### Frontend and server runtime

- React 19, TypeScript, TanStack Router, and TanStack Start implement the application UI, routing, server-side rendering, and server functions.
- Vite and the repository's Lovable TanStack configuration provide the development/build pipeline. The custom `src/server.ts` entry wraps server rendering and normalizes catastrophic server errors.
- React Query manages server-backed query state. The customer cart and checkout selections are held in in-memory React context; they are not persisted across a browser refresh.
- The UI uses Tailwind CSS, Radix-based components, React Hook Form/Zod in form workflows, and Lucide icons.

### Data and identity

- Supabase is the primary backend: PostgreSQL stores marketplace data, Supabase Auth handles phone OTP identity, Storage holds merchant/product images, and Realtime refreshes selected operational views.
- `src/integrations/supabase/types.ts` contains the generated TypeScript database types. `supabase/migrations/` is the schema and policy history; make database changes through migrations rather than ad hoc production edits.
- The browser uses the Supabase URL and publishable key. Publishable keys are intended for client use; access to data is constrained by database grants and Row Level Security (RLS).
- Sensitive application operations use TanStack server functions protected by `requireSupabaseAuth`. The middleware validates the bearer token's claims and passes a user-scoped Supabase client and user ID to the handler.
- Database functions/RPCs implement selected role-aware or atomic operations. Admin capabilities use the `user_roles` table and the `has_role` database function.

### Integrations

| Integration | Implementation |
|---|---|
| Phone OTP | Supabase Auth, with `send-sms-hook` forwarding Auth hook messages to the configured SMS provider. |
| Merchant voice product draft | `voice-product` Edge Function: OpenAI transcription and structured product-field extraction. Publication remains an explicit merchant action through the product workflow. |
| Rider M-Pesa payouts | Authenticated `rider-mpesa-payout` Edge Function submits Daraja B2C requests; `rider-mpesa-callback` processes authenticated provider callbacks. |
| Live operational updates | Supabase Realtime subscriptions on selected tables, alongside normal Supabase queries. |
| Images | Supabase Storage buckets and policies; merchant/product image records are referenced from database rows. |

Provider credentials belong in the relevant server or Supabase Edge Function secret store. Never put service-role, SMS, OpenAI, or Daraja secrets in browser variables, source control, or this document. See [`supabase/functions/README.md`](./supabase/functions/README.md) for provider setup and deployment details.

## Core flows and invariants

### Sign-in and role resolution

1. A user signs in with a phone number and a Supabase Auth OTP.
2. Authenticated server functions verify the bearer token before handling role-specific reads or writes.
3. Workspace access is resolved from the user's merchant/rider records and administrator role; UI navigation is not a substitute for authorization.

### Product and catalog

- Customers read active products and merchants from Supabase; the Discover/featured-merchant experience is database-backed.
- Merchant writes run through authenticated server functions and RLS checks ownership. Product images are uploaded to Storage and the resulting URL is saved with the product.
- Voice-assisted product creation produces a reviewable draft. The merchant must confirm the details and explicitly publish; the voice function does not publish directly or generate product images.

### Order creation and delivery

- Order creation is an authenticated server function. It validates input with Zod, reloads active products and prices from the database, and calculates totals on the server rather than trusting browser-supplied prices.
- Order and order-item rows are stored in PostgreSQL. Merchant, rider, and administrator workflows read/update their authorized operational data; selected live views subscribe to Supabase Realtime.
- Tracking location fields currently use application-level coordinate lookup for areas and rider location updates. This is not a guarantee of a production-grade maps/routing provider.

### Payment and payout boundaries

- The customer checkout UI presents M-Pesa, cash-on-delivery, and bank-transfer choices. **Customer M-Pesa collection/STK push and bank transfer verification are not implemented as provider-backed payment flows.** In the current order creation code, choosing a method other than cash on delivery marks the order `Paid` immediately. This is not proof of payment; do not rely on this status for financial fulfillment until customer payment initiation and verified callbacks are implemented.
- `scan-pay` creates an order; it is not evidence that a payment provider confirmed that order.
- Rider M-Pesa payouts are a separate implemented Daraja B2C flow with idempotent requests and callback reconciliation. Ambiguous provider outcomes are kept for review rather than silently treated as success.
- Merchant payout records are requests; they should not be confused with the rider Daraja payout integration.

## Data model

The central public tables represented by the generated database types include:

| Table | Purpose |
|---|---|
| `merchants`, `products` | Business profiles, catalog items, image references, availability, and stock. |
| `orders`, `order_items` | Customer order summaries, status/payment fields, and purchased item snapshots. |
| `riders` | Rider profile, availability, and delivery-location state. |
| `user_roles` | Administrator role assignments. |
| `merchant_campaigns`, `merchant_campaign_redemptions` | Merchant promotions and redemption records. |
| `merchant_payout_requests`, `rider_payout_requests` | Separate payout-request workflows. |
| `support_tickets` | Operations and customer support tickets. |

Database RPCs cover role checks, order status transitions, rider state/location, payout requests, and administrative reporting/operations. Refer to the migrations and generated types for the authoritative columns, constraints, grants, and RLS policies.

## Repository map

| Path | Responsibility |
|---|---|
| `src/routes/` | File-based customer, merchant, rider, onboarding, authentication, and admin pages. |
| `src/components/` | Shared UI, marketplace components, dashboards, forms, and product-voice workflow. |
| `src/lib/` | Data access, authenticated server functions, validation, identity/workspace resolution, and domain helpers. |
| `src/integrations/supabase/` | Supabase browser client, server-function auth middleware, and generated database types. |
| `src/server.ts` | TanStack Start server entry and SSR error handling. |
| `src/test/` | Vitest and Testing Library tests. |
| `supabase/migrations/` | Versioned PostgreSQL schema, RLS, RPC, and storage-policy changes. |
| `supabase/functions/` | Deno Edge Functions for SMS, rider payouts/callbacks, and voice product assistance. |
| `supabase/functions/README.md` | Edge Function secrets, setup, and deployment notes. |
| `package.json` | Frontend/build/test scripts and dependency manifest. |

## Implementation status and known gaps

### Implemented

- Phone-based OTP sign-in and database-backed user workspace resolution.
- Customer catalog, product pages, cart/checkout UI, authenticated order creation, and order views.
- Merchant onboarding, database-backed profile and catalog management, Storage-backed images, and voice-assisted product drafting.
- Rider onboarding/dashboard, delivery status/location operations, and a Daraja B2C rider payout request/callback workflow.
- Administrator routes and database-backed operational/reporting functionality.
- RLS policies, authenticated server functions, migrations, and selected Realtime subscriptions.

### Incomplete or important constraints

- Customer payment collection/verification is incomplete as described above; checkout's current `Paid` status must not be interpreted as provider confirmation.
- Customer ordering requires an authenticated user; guest checkout is not implemented.
- The cart is in memory and is lost on refresh.
- A customer order row is associated with the merchant on the first cart item. The current order shape does not implement a proper split into multiple merchant orders; multi-merchant carts should not be treated as a supported fulfillment contract.
- Voice transcription/extraction depends on OpenAI availability, quota, and Edge Function secrets. AI image generation is not configured.
- SMS and Daraja behavior depend on provider credentials, sender/shortcode approvals, callback reachability, and provider-side configuration. A successful provider API submission is not identical to handset delivery or final settlement.

## Local development and validation

### Requirements

- Node.js compatible with the repository's Vite 8 toolchain and npm.
- Access to a configured Supabase project for authenticated/data-backed flows.
- Supabase CLI only when applying migrations or running/deploying Edge Functions.

### Setup

```sh
npm ci
```

Configure the frontend/runtime Supabase settings in your local environment:

```text
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

Keep all keys out of source control. The `VITE_` variables are included in browser code and must contain only the publishable key, never a service-role or secret key. Server-only integrations use Supabase Edge Function secrets; frontend `.env` values are not automatically available to deployed functions.

### Commands

```sh
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm test          # Run the Vitest suite
npm run lint      # Run ESLint
```

For database work, add a migration under `supabase/migrations/`, review its RLS/grants and data implications, and apply it intentionally to the correct project with the Supabase CLI. For Edge Function deployment, follow [`supabase/functions/README.md`](./supabase/functions/README.md).

## Feature development guidelines

1. Trace the existing route, UI, data, and authorization flow before adding a new one.
2. Keep business-critical validation and calculations on the server or database; treat browser input as untrusted.
3. Use authenticated server functions for user-scoped writes and preserve database RLS as the final authorization boundary.
4. Add schema changes as migrations and update generated database types through the repository's Supabase workflow.
5. Keep provider secrets server-side and verify callbacks before changing financial or order state.
6. Add focused tests for the behavior and run the relevant test/build/lint commands before considering a change complete.