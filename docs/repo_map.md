# Repo Map

This document describes where responsibilities live in the codebase.

## Top-level

- `src/`: frontend app code (React + TypeScript)
- `api/`: Vercel serverless APIs
- `public/`: static assets/pages served as-is
- `scripts/`: operational scripts and SQL migrations
- `tests/`: Playwright tests
- `tools/`: auxiliary generators (poster tooling)
- `docs/`: runbooks and project documentation
- `seed/`: source datasets used by seed tooling
- `data/`: runtime data and archived datasets

## Frontend (`src/`)

- `src/app/`: page-level orchestration (`App.tsx`, register flow)
- `src/components/`: reusable UI components
- `src/lib/`: domain logic (reports, account, weather, analytics, formatting)
- `src/config/`: feature flags and public URL logic
- `src/data/`: typed data source imports for app runtime
- `src/map/`: map icon logic and related map helpers
- `src/i18n/`: language strings
- `src/styles/`: global styles
- `src/types/`: shared TS types for app layer

## API (`api/`)

- `api/waitlist/`: waitlist endpoints (`index`, `count`, `confirm`)
- `api/reports/`: crowd reports read/write endpoint
- `api/account/`: authenticated account actions
- `api/analytics.ts`: anonymous server-side analytics ingestion
- `api/weather.ts`: weather proxy endpoint
- `api/app-access.ts`: app gate access endpoint

## SQL Migrations (`scripts/sql/`)

- `waitlist_phase1.sql`: waitlist core schema
- `waitlist_rate_limits.sql`: waitlist rate limiter schema
- `app_auth_favorites.sql`: auth/favorites schema
- `app_crowd_reports.sql`: crowd reports schema
- `app_analytics_events.sql`: anonymous analytics events schema

## Conventions

- Keep frontend-only concerns in `src/`; keep HTTP/DB concerns in `api/`.
- Prefer adding new docs to `docs/` and linking them from `README.md`.
- Prefer additive changes (feature flags/configs/docs) over broad refactors.
