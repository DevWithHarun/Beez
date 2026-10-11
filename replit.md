# Running BEEZ on Replit

This import keeps the original React, TypeScript, Vite, and TanStack Start stack and project structure.

- Click Run to start the `Start application` workflow.
- The workflow runs `bun run dev` on `0.0.0.0:5000`; view the site in Preview.
- Install dependencies with `bun install`, using the existing `bun.lock`.
- Run tests with `bun run test` and make a production build with `bun run build`.

Keep the existing content, hash routes, and placeholder links unless requested otherwise. Follow `AGENTS.md` for project-specific guidance.

The world map uses `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` and the optional `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`. The browser key must allow the site's domain in Google Maps restrictions. Without a valid authorized key, the map displays its existing connection error; the other landing-page content does not require it.
