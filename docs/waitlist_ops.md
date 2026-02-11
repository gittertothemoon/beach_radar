# Waitlist Ops

This repo hosts a static waitlist page (`public/waitlist/index.html`) and a Vercel Serverless API (`/api/waitlist`).

## Local dev

1) Install dependencies:
```
npm ci
```

2) Start the local server with Vercel (required for `/api/*`):
```
vercel dev --listen 3000 --yes
```

If you want to run without Supabase (tests or offline), start with:
```
WAITLIST_TEST_MODE=1 vercel dev --listen 3000 --yes
```

3) Open the waitlist page:
```
http://localhost:3000/waitlist/index.html
```

If you do not want to hit Supabase during local dev/tests, set:
```
WAITLIST_TEST_MODE=1
```

## Tests

Full suite (API + E2E):
```
BASE_URL=http://localhost:3000 WAITLIST_PATH=/waitlist/index.html npm run test:waitlist
```

API-only / E2E-only:
```
BASE_URL=http://localhost:3000 WAITLIST_PATH=/waitlist/index.html npm run test:waitlist:api
BASE_URL=http://localhost:3000 WAITLIST_PATH=/waitlist/index.html npm run test:waitlist:e2e
BASE_URL=http://localhost:3000 REPORTS_TEST_MODE=1 npm run test:reports:api
```

Smoke test (safe for production, hits API only with invalid/honeypot):
```
BASE_URL=https://beachradar.it npm run test:waitlist:smoke
```

Smoke test (static, UI-only; no API required):
```
npm run test:waitlist:smoke:static
```

CI behavior:
- Pull requests run the static smoke suite only (UI guardrail, no `/api/*`).
- Push to `main` runs the full suite with `vercel dev` (end-to-end guardrail).

Smoke runner env flags:
- `SMOKE_READY_TIMEOUT_MS` (override wait for SMOKE_READY; default 12000)
- `SMOKE_VERIFY_CLEANUP=1` (fail if the static server port stays open after cleanup)
- `SMOKE_TEST_NO_READY=1` (test-only flag to simulate no SMOKE_READY)

## Required env vars

Production API:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

App access gate:
- `APP_ACCESS_KEY` (required to access `/app/`)

App auth (frontend):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

App feature flags (frontend, optional):
- `VITE_USE_MOCK_CROWD` (`true/false`, default `false`)
- `VITE_FORCE_REMOTE_REPORTS` (`true/false`, default `false`)
- `VITE_REPORTS_POLL_MS` (default `60000`)

Crowd reports API (optional local test mode):
- `REPORTS_TEST_MODE=1` (uses in-memory reports store, no Supabase writes)
- `REPORTS_RATE_LIMIT_MIN` (default: 10, min 1, max 60)
- `REPORTS_LOOKBACK_HOURS` (default: 6, min 1, max 48)
- `REPORTS_GET_LIMIT` (default: 5000, min 100, max 10000)
- `REPORTS_HASH_SALT` (optional but recommended; used to salt IP/User-Agent hashes before DB write)
- `REPORTS_RETENTION_DAYS` (default: 30; used by prune job)
- `REPORTS_PRUNE_TOKEN` (optional fallback auth token for manual prune calls)
- `CRON_SECRET` (recommended; Vercel Cron sends it as Bearer token)

Rate limit tuning:
- `WAITLIST_RATE_LIMIT_MAX` (default: 10)
- `WAITLIST_RATE_LIMIT_WINDOW_SEC` (default: 600)
- `TEST_RATE_LIMIT` (optional override for tests)

Double opt-in (optional):
- `ENABLE_DOUBLE_OPTIN=1`
- `RESEND_API_KEY`
- `WAITLIST_FROM`
- `WAITLIST_CONFIRM_URL`

Privacy contact (optional front-end override):
- `PRIVACY_CONTACT_EMAIL` (set `window.PRIVACY_CONTACT_EMAIL` in `public/privacy/index.html` or edit the file directly)

## App access

The app is gated behind `/app/`. Provide the access key once via:
```
https://beachradar.it/app/?key=YOUR_KEY
```
After a valid key is used, a 30-day cookie is set so `/app/` works without the query parameter.

Notes:
- If the key contains special characters, URL-encode it in the browser URL (encode once).
- `APP_ACCESS_KEY` in Vercel must be the raw key (not URL-encoded).
- After changing `APP_ACCESS_KEY`, redeploy to apply it.

## Rate limit behavior

The API uses a Supabase-backed rate limiter keyed by hashed IP + hashed user agent and a time window.
If the limit is exceeded, the API responds with:
```
{ ok: false, error: "rate_limited", retry_after: <seconds> }
```

Tuning:
- Increase `WAITLIST_RATE_LIMIT_MAX` to allow more requests per window.
- Decrease `WAITLIST_RATE_LIMIT_WINDOW_SEC` to shorten the window.

## SQL migrations (Supabase)

Run these in the Supabase SQL editor (in order):
- `scripts/sql/waitlist_phase1.sql`
- `scripts/sql/waitlist_rate_limits.sql`
- `scripts/sql/app_auth_favorites.sql`
- `scripts/sql/app_crowd_reports.sql`

Note:
- Crowd reports store salted hashes for `source_ip` and `user_agent` (not raw values) when submitted through `/api/reports`.

## Data retention and cleanup

- Waitlist data is retained until launch plus up to 12 months (or deletion on request).
- Rate limit data can be pruned periodically. Example cleanup query:
```
delete from public.waitlist_rate_limits
where window_start < now() - interval '30 days';
```

Crowd reports cleanup:
- Vercel cron is configured in `vercel.json` to call `/api/reports/prune` daily.
- The endpoint deletes rows older than `REPORTS_RETENTION_DAYS`.
- Auth: `Authorization: Bearer <token>` where token is `CRON_SECRET` (preferred) or `REPORTS_PRUNE_TOKEN`.
- Dry run: `GET /api/reports/prune?dry=1` (same auth), returns `candidateCount` without deleting.
