# Where2Beach Mobile

Expo mobile app for Where2Beach.

Current phase:
- Native `reports` screen (feed + submit to `/api/reports`)
- Native `weather` screen (live weather from `/api/weather`)
- Native `waitlist` screen (submit to `/api/waitlist`)
- Web map fallback screen (`/app/`) for full map parity

## Setup

```bash
npm ci
cp .env.example .env
npm run start
```

## Environment

- `EXPO_PUBLIC_BASE_URL`: public base URL (default `https://where2beach.com`)
- `EXPO_PUBLIC_APP_ACCESS_KEY`: optional app gate key for `/app/`
- `EXPO_PUBLIC_API_TIMEOUT_MS`: timeout for mobile API calls in ms (default `12000`)

## Scripts

```bash
npm run start
npm run ios
npm run android
npm run typecheck
```
