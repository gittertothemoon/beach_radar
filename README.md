# Where2Beach

Where2Beach is a Vite + React + TypeScript app with Vercel serverless APIs.
The project currently includes:

- public landing flow (`/landing/`)
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
npm run mobile:ios          # Safe iOS dev: auto-starts local API (:3000) + web (:5173) when needed, then Expo iOS
npm run mobile:ios:expo     # Expo iOS target only (no stack bootstrap)
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

The app does not include landing flows in its navigation.

Run it:

```bash
npm run mobile:start
npm run mobile:ios
```

`npm run mobile:ios` is the recommended command for local simulator work.
When `mobile/.env` has `EXPO_PUBLIC_BASE_URL` set to `http://127.0.0.1:<port>` or `http://localhost:<port>`,
it ensures required local services are running first:

- Vercel dev API on `http://127.0.0.1:3000`
- Vite dev frontend on `EXPO_PUBLIC_BASE_URL`

Then it opens Expo iOS. If you explicitly want Expo only, use:

```bash
npm run mobile:ios:expo
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
- Chatbot API: `OPENAI_API_KEY` (required), `OPENAI_CHAT_MODEL` (default `gpt-5.4-nano`)

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
- `OPENAI_CHAT_REASONING_EFFORT`
- `OPENAI_CHAT_MAX_OUTPUT_TOKENS`
- `OPENAI_CHAT_MAX_OUTPUT_TOKENS_COMPLEX`
- `OPENAI_CHAT_TIMEOUT_MS`
- `OPENAI_CHAT_RATE_LIMIT`
- `OPENAI_CHAT_COMPLEX_MODEL`
- `OPENAI_CHAT_COMPLEX_ROUTING`
- `OPENAI_CHAT_RESPONSE_CACHE_TTL_SEC`
- `OPENAI_CHAT_RESPONSE_CACHE_MAX_ITEMS`
- `OPENAI_CHAT_DAILY_TOKEN_BUDGET`
- `CHATBOT_SALT`
- `SIGNUP_HASH_SALT`
- `CRON_SECRET`

## Supabase Automation

One-command flow:

```bash
npm run supabase:auto
```

What it does:
- normalizes `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values in local env files (removes accidental literal `\n`)
- runs connectivity checks (`anon` + `service_role`)
- initializes `supabase/` config if missing
- syncs `scripts/sql/*.sql` into `supabase/migrations/` (idempotent, source-tagged)
- applies pending migrations when credentials for schema apply are available

If schema credentials are missing, `supabase:auto` exits with non-zero status.

Automation env options:
- linked mode: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`
- db-url mode: `SUPABASE_DB_URL` (alternative to linked mode)

Useful commands:
- `npm run supabase:doctor`
- `npm run supabase:migrations:sync`
- `npm run supabase:migrate`

## Security Guardrails (CI)

Local security checks:

```bash
npm run security:sinks       # blocks dangerous HTML sinks (allowlist-aware)
npm run security:smoke       # checks live security headers and no-store APIs
npm run security:advisors    # checks Supabase advisors (allowlist-aware)
```

GitHub Actions workflow: `.github/workflows/security-guardrails.yml`

- runs on push/PR to `main`
- runs weekly (`cron`) and on manual dispatch
- enforces:
  - dangerous sink scan (`dangerouslySetInnerHTML`, `innerHTML`, `document.write`)
  - dependency audits (root + `w2b-hero`, high severity and above)
  - live HTTP security smoke (`/landing/`, `/privacy/`, `/api/app-access`, `/api/signup`)
  - Supabase advisor check with allowlist (`auth_leaked_password_protection` for Free plan)

Recommended repo secrets/variables:

- `SECURITY_BASE_URL` (repo variable, optional; default: `https://where2beach.com`)
- One of:
  - `SUPABASE_DB_URL_CI` (or `SUPABASE_DB_URL`)
  - `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`

## Server Analytics (Minimal)

- Endpoint: `POST /api/analytics`
- Storage: `public.analytics_events` (append-only)
- Payload is anonymous: no emails, no raw IP, no raw user-agent
- Retention is configurable at DB/ops level (table is append-only by default)
- Client behavior is fail-silent with short timeout and retry
- Existing local analytics (`localStorage`) are preserved for debug export compatibility

SQL migration:

- `scripts/sql/app_analytics_events.sql`

## Chatbot API (Cost-First Setup)

- Endpoint: `POST /api/chatbot`
- UI: tab `Chatbot` nel bottom sheet di `/app/`
- Model default: `gpt-5.4-nano` (override con `OPENAI_CHAT_MODEL`)
- Cost guardrails inclusi:
  - output cap adattivo (`OPENAI_CHAT_MAX_OUTPUT_TOKENS`, default `180`)
  - cap separato per richieste complesse (`OPENAI_CHAT_MAX_OUTPUT_TOKENS_COMPLEX`, default `220`)
  - reasoning effort configurabile (default `low`)
  - rate limit per IP+UA (`OPENAI_CHAT_RATE_LIMIT`, default `15/min`)
  - timeout upstream (`OPENAI_CHAT_TIMEOUT_MS`, default `15000`)
  - cache risposte con TTL + LRU (`OPENAI_CHAT_RESPONSE_CACHE_TTL_SEC`, default `43200`; `OPENAI_CHAT_RESPONSE_CACHE_MAX_ITEMS`, default `600`)
  - deduplica richieste concorrenti identiche (single upstream call)
  - budget token giornaliero (`OPENAI_CHAT_DAILY_TOKEN_BUDGET`, default `120000`)
  - routing opzionale verso modello "complesso" (`OPENAI_CHAT_COMPLEX_MODEL`, `OPENAI_CHAT_COMPLEX_ROUTING`, default `0`)
  - compattazione conversazione prima della chiamata upstream
  - risposte locali per FAQ frequenti (evita chiamate API inutili)

## Repo Docs

- `docs/README.md`: documentation index
- `docs/repo_map.md`: directory map and ownership boundaries
- `docs/mobile_qa_checklist.md`: mobile map QA checklist (manual + automated)
- `tools/posters/README.md`: poster generation workflow
- `CONTRIBUTING.md`: contribution and quality workflow

## Domain & Share Preview Checks

1. `https://www.where2beach.com` must 301 to `https://where2beach.com`
2. `https://where2beach.vercel.app` must 301 to `https://where2beach.com`
3. `http://where2beach.com` must 301 to `https://where2beach.com`
4. Sharing `https://where2beach.com` in messaging apps should show correct preview
