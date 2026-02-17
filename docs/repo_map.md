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
- `seed/`: geocoded intermediate datasets and runtime overrides used by seed tooling
- `data/`: raw source datasets, KML intake, and archived datasets
- `remotion/`: video rendering project and media kit assets

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

## Seed Flow (`scripts/seed/`)

- `scripts/seed/geocode.mjs`: geocode seed generation from raw source schemas
- `scripts/seed/sync.mjs`: canonical sync from `seed/` to `src/data/`
- `scripts/seed/validate.mjs`: integrity checks for ids/coords/schema/sync state
- `scripts/seed/lib/sync-utils.mjs`: shared seed merge/sync utilities
- `scripts/sync-brand-assets.mjs`: keeps duplicated brand assets aligned across app/waitlist/remotion
- `scripts/repo-hygiene.mjs`: guardrail checks for root clutter, tracked generated outputs, and raw naming

## KML Intake (`data/raw/kml/`)

- Drop new KML exports here before import/mapping operations.
- Keep source filenames stable to preserve provenance in `notes`.

## Poster Output (`tools/posters/out/`)

- This directory contains generated PNG artifacts.
- It should be treated as local build output and not committed.

## Conventions

- Keep frontend-only concerns in `src/`; keep HTTP/DB concerns in `api/`.
- Prefer adding new docs to `docs/` and linking them from `README.md`.
- Prefer additive changes (feature flags/configs/docs) over broad refactors.
