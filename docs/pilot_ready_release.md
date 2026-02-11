# Pilot Ready PR + Release Checklist

Date baseline: February 11, 2026

## PR Description (ready to paste)

### Summary
This PR hardens Beach Radar for pilot operations without changing visible UI or feature behavior.

Scope delivered:
- P0: CI quality guardrail (`lint`, `typecheck`, `build`) on `push`/`pull_request` to `main`.
- P1: Minimal server-side anonymous analytics ingestion (`POST /api/analytics`) with payload validation, lightweight rate-limiting, Supabase insert, and fail-silent client delivery.
- P2: Stable Playwright E2E coverage for `/app` critical flows (gating, map modal open, report submit, favorites anonymous prompt, favorites auth sync when credentials are provided).

### Key Technical Choices
- No PII in analytics payload/storage: no email, no raw IP, no raw user agent.
- Analytics remains backward-compatible with local debug export (`localStorage` kept), while server ingestion runs in parallel with short timeout/retry and silent failure.
- E2E selectors added via minimal `data-testid` attributes only where needed to reduce flakiness.
- `/app` UI tests run against Vite dev server (`/app/`) and gating tests run against Vercel dev to preserve route/cookie behavior.

### Database
- Added migration: `scripts/sql/app_analytics_events.sql`
- New table: `public.analytics_events` (append-only event log)
- RLS: write/read only for `service_role` policy context
- Indexes for `created_at`, `(event_name, created_at)`, `(session_id, created_at)`, unique optional `event_id` dedup

### Environment
- Required server env for analytics:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Optional analytics tuning:
  - `ANALYTICS_RATE_LIMIT` (default 60 req/min)
  - `ANALYTICS_SALT` (recommended)

### Validation
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Playwright:
  - `tests/app.gating.spec.ts` (pass)
  - `tests/app.map.spec.ts` (pass)
  - `tests/app.reports.spec.ts` (pass)
  - `tests/app.favorites.spec.ts`:
    - anonymous flow pass
    - authenticated flow executes when `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` are set

### Non-Goals / Preserved Behavior
- No visible UI redesign, no routing redesign, no product feature changes.
- Existing waitlist/app flows and access gating remain unchanged.

## Release Checklist

1. Database and env
- Confirm `scripts/sql/app_analytics_events.sql` has been executed on target Supabase project.
- Confirm Vercel env exists in `preview` and `production`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANALYTICS_RATE_LIMIT`
  - `ANALYTICS_SALT`

2. CI gates
- Confirm GitHub Actions green:
  - `App Quality` workflow
  - Waitlist/App Playwright workflow

3. Production smoke
- Run:
```bash
curl -X POST https://beachradar.it/api/analytics \
  -H "content-type: application/json" \
  -d '{"eventName":"pilot_check","ts":"2026-02-11T12:00:00.000Z","sessionId":"manual-check","path":"/app"}'
```
- Expect `200` with `{"ok":true}`.

4. Optional full E2E auth coverage
- Set:
  - `E2E_TEST_USER_EMAIL`
  - `E2E_TEST_USER_PASSWORD`
- Re-run `npm run test:app:favorites` to execute authenticated favorites sync assertion.

5. Observability after go-live (first 24h)
- Track function errors for `/api/analytics` (should remain near zero).
- Monitor event ingestion volume for obvious anomalies (sudden drop to zero or spikes).
- Keep retention/pruning policy explicit at DB ops layer.
