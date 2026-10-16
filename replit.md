# Replit development

## Web preview

The `Beez web` workflow runs the existing React/Vite application on port 5000.
Use the Run button to open the landing page in Preview. On phones, the landing
page shows the Discover, Track, Sell and Ride navigation bar at the bottom.

To run it manually:

```sh
cd web
npm ci
npm run dev
```

The web app proxies `/api` to `http://localhost:8080`. The Spring Boot backend
can be packaged with `cd backend && mvn package`; it is not started by the
current Replit workflow. Running API-backed commerce features also requires
PostgreSQL, Redis, and the backend's required authentication secrets. See
`.env.example` and `backend/README.md` for configuration; never commit secrets.
