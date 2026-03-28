# Where2Beach Mobile

Expo mobile app for Where2Beach.

Current target:
- mobile opens the definitive `/app/` experience (map + pins + full app flow)
- no landing flow inside the app

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
- `EXPO_PUBLIC_REPORT_ANYWHERE`: QA-only flag (`1`) to enable remote report submit without geofence
- `EXPO_PUBLIC_DEV_MOCK_AUTH`: dev-only flag (`1`) to force a mock authenticated session in WebView
- `EXPO_PUBLIC_DEV_MOCK_EMAIL`: optional mock account email shown in profile when dev mock auth is enabled

## Scripts

```bash
npm run start
npm run ios              # safe iOS startup (checks/boots local web+api stack when base URL is local)
npm run ios:expo         # Expo iOS only (no local stack bootstrap)
npm run android
npm run typecheck
npm run eas:build:android:preview
npm run eas:build:ios:preview
npm run eas:build:ios:prod
npm run eas:submit:ios:prod
```

## Internal Builds (EAS)

1. Login:
```bash
npx eas-cli login
```

2. Set required app key secret (once per project):
```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_APP_ACCESS_KEY --value "<APP_ACCESS_KEY>"
```

3. Build:
```bash
# Android internal APK
npm run eas:build:android:preview

# iOS internal build
npm run eas:build:ios:preview
```

## App Store (iOS) Quick Path

```bash
# 1) Build store-ready .ipa
npm run eas:build:ios:prod

# 2) Submit latest .ipa to App Store Connect / TestFlight
npm run eas:submit:ios:prod
```

Notes:
- `eas submit` with `--what-to-test` may require higher Expo plan; keep submit command without that flag on Free.
- If submission fails, inspect the submission URL printed by EAS for exact Apple-side rejection reason.

## Release Prep

- Store release checklist and runbook:
  - `docs/mobile_release_ready_pack.md`
- Manual + automated QA before release:
  - `docs/mobile_qa_checklist.md`
- Legal URLs for store metadata (public, no login):
  - `https://where2beach.com/privacy/`
  - `https://where2beach.com/cookie-policy/`
