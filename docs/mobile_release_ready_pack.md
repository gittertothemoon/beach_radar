# Mobile Release-Ready Pack

Date baseline: March 22, 2026

Purpose:
- Keep all store-release prerequisites ready while waiting for account approvals.
- Execute iOS submission quickly as soon as Apple enables the developer team.

## Current Status Snapshot

- EAS account: authenticated (`pionio`)
- iOS: production `.ipa` builds available (latest finished build: `0199e901-8636-44cc-ae16-5cfc7a972791`, build number `8`)
- Android: production AAB available (latest finished build: `ca3e78a4-3d79-48a3-b707-ffd222516404`, build number `3`)
- App Store Connect API key: configured in EAS submit profile
- iOS submission attempts: schedulable, but failed during Apple processing (check latest EAS submission URL for rejection reason/details)

## What Can Be Finalized Now

1. Product metadata
- App name (store display): `Where2Beach`
- Subtitle / short description
- Full description
- Keywords
- Category and subcategory

2. Legal and support URLs
- Privacy Policy URL (public and reachable without login)
- Terms URL (if available)
- Support URL (email or landing page)
- Marketing URL (optional, recommended)
- Suggested defaults for this repo:
  - Privacy: `https://where2beach.com/privacy/`
  - Terms: `https://where2beach.com/terms/`
  - Cookie policy: `https://where2beach.com/cookie-policy/`
  - These pages can auto-redirect to iubenda direct links when `LEGAL_*` env vars are configured.

3. Store assets
- App icon (1024x1024, no transparency for App Store)
- iPhone screenshots (required sizes):
  - 6.7" (e.g. 1290x2796 or 1284x2778)
  - 6.5" (e.g. 1242x2688)
  - 5.5" can be auto-scaled if accepted by current App Store Connect rules
- Optional promo text + preview video

4. Compliance answers prep
- Data collection matrix (what data is collected, linked to user or not)
- Tracking usage (ATT): yes/no
- Encryption export compliance (`ITSAppUsesNonExemptEncryption=false` already set)
- Content rights confirmation

## iOS Submission Runbook (Current)

1. Confirm access
- Ensure `npx eas-cli whoami` works.
- Ensure App Store Connect app record exists for bundle id `com.where2beach.mobile`.

2. Validate build inputs
```bash
npm run check
npm --prefix mobile run typecheck
```

3. Build production iOS binary
```bash
cd mobile
npx eas-cli build --platform ios --profile production
```

4. Submit to TestFlight
```bash
cd mobile
npx eas-cli submit --platform ios --latest --profile production
```

5. Post-submit checks
- Confirm build appears in App Store Connect -> TestFlight.
- Add internal testers.
- Smoke test:
  - map boot
  - pin details
  - report submit
  - favorites auth gating

6. If submit fails
- Open the EAS submission details URL printed by CLI.
- Read Apple processing error and fix root cause before retry (metadata/compliance/build settings).

## Android Runbook (When Play Console Is Activated)

1. Create Google Play Developer account.
2. Create Google Service Account JSON key and grant Play Console permissions.
3. Submit latest production AAB:
```bash
cd mobile
npx eas-cli submit --platform android --latest --profile production
```

## Release Notes Draft (Template)

Version: `1.0.0`

Highlights:
- Mobile app opens directly on definitive map experience.
- Pin interaction and map behavior fixes.
- Reporting flow extended with jellyfish/algae conditions.
- Mobile UI cleanup for full-screen map and status-bar readability.

Known limitations:
- iOS public release timing depends on Apple account approval.
- Android Play rollout depends on Play Console activation.
