# Contributing

## Requirements

- Node 20 (`.nvmrc`)
- npm (lockfile is authoritative)

## Setup

```bash
nvm use
npm ci
cp .env.example .env.local
```

## Development Modes

- Frontend only:
```bash
npm run dev
```

- Full local stack (`/api/*` enabled):
```bash
vercel dev --listen 3000 --yes
```

## Quality Gate (before push)

```bash
npm run lint
npm run typecheck
npm run build
npm run repo:hygiene
npm run assets:check
```

Optional waitlist checks:

```bash
BASE_URL=http://127.0.0.1:3000 WAITLIST_PATH=/waitlist/index.html npm run test:waitlist
```

## Commit Guidelines

- Keep commits focused and atomic.
- Avoid mixing refactors with behavior changes unless tightly coupled.
- Include operational/documentation updates with feature work when relevant.

## Safety Rules

- Do not commit secrets (`.env`, service keys, tokens).
- Prefer non-destructive migrations and backward-compatible API changes.
- If changing data contracts, update both API and frontend consumers in the same PR.
