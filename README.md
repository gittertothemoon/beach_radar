# Where2Beach

Where2Beach is a Vite + React + TypeScript app with Vercel serverless APIs.
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

5. Start landing (Next.js hero) with safe cleanup + Node 20 enforcement:
```bash
npm run landing:dev
```

6. If you need `/api/*` locally, run Vercel dev:
```bash
vercel dev --listen 3000 --yes
```

## Core Scripts

```bash
npm run dev                 # Vite app
npm run landing:dev         # Next landing (safe: kills :3000, clears stale .next, runs with Node 20)
npm run landing:build       # Builds Vite app + Next landing
npm run lint                # ESLint
npm run typecheck           # TypeScript project refs check
npm run check               # lint + typecheck
npm run build               # production build
npm run preview             # preview dist
npm run mobile:start        # Expo mobile app
npm run mobile:ios          # Expo iOS target
npm run mobile:android      # Expo Android target
npm run mobile:typecheck    # TypeScript check (mobile)
npm run mobile:build:android:preview  # EAS Android internal APK
npm run mobile:build:ios:preview      # EAS iOS internal build
```

Hero + app-shell (single Vercel project):

```bash
npm --prefix w2b-hero run build    # builds Vite app + syncs assets/APIs + builds Next hero
```

`w2b-hero` build now includes an automatic sync step that:
- builds the root Vite app
- copies `dist/index.html` to `w2b-hero/public/app-shell/index.html`
- copies `dist/assets/*` to `w2b-hero/public/assets/*`
- syncs required static files (`manifest`, favicons, `icons`, `og`)
- syncs serverless APIs from `api/*` to `w2b-hero/api/*`

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
npm run assets:sync
npm run assets:check
npm run repo:hygiene
npm run check:all
npm run posters:csv
npm run posters:gen
```

KML intake directory: `data/raw/kml/`

## Mobile App (Expo)

The repo includes a mobile app in `mobile/` that opens the definitive `/app/`
experience (map + pins + full app flow) in mobile.

The app does not include landing/waitlist flows in its navigation.

Run it:

```bash
npm run mobile:start
```

Optional mobile env vars (`EXPO_PUBLIC_*`) can be set in `mobile/.env`:

- `EXPO_PUBLIC_BASE_URL` (default: `https://where2beach.com`)
- `EXPO_PUBLIC_APP_ACCESS_KEY` (required app gate key for `/app/`)
- `EXPO_PUBLIC_API_TIMEOUT_MS` (default: `12000`)
- `EXPO_PUBLIC_REPORT_ANYWHERE` (QA-only, set `1` to bypass report geofence)

Internal build (EAS):

```bash
npx eas-cli login
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_APP_ACCESS_KEY --value "<APP_ACCESS_KEY>"
npm run mobile:build:android:preview
npm run mobile:build:ios:preview
```

## Environment Variables

See `.env.example` for the full list.

Most important:

- frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_BASE_URL`
- APIs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ACCESS_KEY` (or `APP_ACCESS_KEY_HASH`)

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
- `docs/mobile_qa_checklist.md`: mobile map QA checklist (manual + automated)
- `tools/posters/README.md`: poster generation workflow
- `CONTRIBUTING.md`: contribution and quality workflow

## Domain & Share Preview Checks

1. `https://www.where2beach.com` must 301 to `https://where2beach.com`
2. `https://where2beach.vercel.app` must 301 to `https://where2beach.com`
3. `http://where2beach.com` must 301 to `https://where2beach.com`
4. Sharing `https://where2beach.com` in messaging apps should show correct preview
