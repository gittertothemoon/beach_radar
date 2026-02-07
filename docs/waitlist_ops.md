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

## Data retention and cleanup

- Waitlist data is retained until launch plus up to 12 months (or deletion on request).
- Rate limit data can be pruned periodically. Example cleanup query:
```
delete from public.waitlist_rate_limits
where window_start < now() - interval '30 days';
```
