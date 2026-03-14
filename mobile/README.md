# Where2Beach Mobile

Expo mobile app for Where2Beach.

Current target:
- mobile opens the definitive `/app/` experience (map + pins + full app flow)
- no landing/waitlist flow inside the app

## Setup

```bash
npm ci
cp .env.example .env
npm run start
```

## Environment

- `EXPO_PUBLIC_BASE_URL`: public base URL (default `https://where2beach.com`)
- `EXPO_PUBLIC_APP_ACCESS_KEY`: required app gate key for `/app/` access
- `EXPO_PUBLIC_API_TIMEOUT_MS`: timeout for mobile API calls in ms (default `12000`)

## Scripts

```bash
npm run start
npm run ios
npm run android
npm run typecheck
```
