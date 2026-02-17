# Beach Radar

Beach Radar is a Vite + React + TypeScript app with Vercel serverless APIs.
The project currently includes:

- public waitlist flow (`/waitlist/`)
- gated app flow (`/app/`) with map, reports, weather, account/favorites
- Supabase-backed APIs (`/api/*`)

## Tech Stack

- Frontend: React 19, Vite 7, TypeScript
- Map: Leaflet + react-leaflet
- Backend/API: Vercel Functions (`api/`)
- Data/Auth: Supabase
- Tests: Playwright (API + E2E + smoke)

## Quick Start

1. Use Node 20:
```bash
nvm use
```

2. Install dependencies:
```bash
npm ci
```

3. Copy env template:
```bash
cp .env.example .env.local
```

4. Start frontend-only dev server:
```bash
npm run dev
```

5. If you need `/api/*` locally, run Vercel dev:
```bash
vercel dev --listen 3000 --yes
```

## Core Scripts

```bash
npm run dev                 # Vite app
npm run lint                # ESLint
npm run typecheck           # TypeScript project refs check
npm run check               # lint + typecheck
npm run build               # production build
npm run preview             # preview dist
```

Waitlist tests:

```bash
npm run test:waitlist
npm run test:waitlist:api
npm run test:waitlist:e2e
npm run test:waitlist:smoke
npm run test:waitlist:smoke:static
```

App tests:

```bash
npm run test:app
npm run test:app:gating
npm run test:app:map
npm run test:app:reports
npm run test:app:favorites
```

Seed & tooling:

```bash
npm run seed:geocode
npm run seed:sync
npm run seed:validate
npm run posters:csv
npm run posters:gen
```

## Environment Variables

See `.env.example` for the full list.

Most important:

- frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_BASE_URL`
- APIs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ACCESS_KEY`

Optional feature flags:

- `VITE_USE_MOCK_CROWD`
- `VITE_FORCE_REMOTE_REPORTS`
- `VITE_REPORTS_POLL_MS`
- `REPORTS_RATE_LIMIT_MIN`
- `REPORTS_LOOKBACK_HOURS`
- `REPORTS_GET_LIMIT`
- `REPORTS_HASH_SALT`
- `REPORTS_RETENTION_DAYS`
- `ANALYTICS_RATE_LIMIT`
- `ANALYTICS_SALT`
- `CRON_SECRET`

## Server Analytics (Minimal)

- Endpoint: `POST /api/analytics`
- Storage: `public.analytics_events` (append-only)
- Payload is anonymous: no emails, no raw IP, no raw user-agent
- Retention is configurable at DB/ops level (table is append-only by default)
- Client behavior is fail-silent with short timeout and retry
- Existing local analytics (`localStorage`) are preserved for debug export compatibility

SQL migration:

- `scripts/sql/app_analytics_events.sql`

## Repo Docs

- `docs/README.md`: documentation index
- `docs/repo_map.md`: directory map and ownership boundaries
- `docs/waitlist_ops.md`: waitlist runbook (local, CI, envs, SQL, retention)
- `tools/posters/README.md`: poster generation workflow
- `CONTRIBUTING.md`: contribution and quality workflow

## Domain & Share Preview Checks

1. `https://www.beachradar.it` must 301 to `https://beachradar.it`
2. `https://beach-radar.vercel.app` must 301 to `https://beachradar.it`
3. `http://beachradar.it` must 301 to `https://beachradar.it`
4. Sharing `https://beachradar.it` in messaging apps should show correct preview
