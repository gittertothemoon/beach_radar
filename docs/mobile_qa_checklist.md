# Mobile QA Checklist

Date baseline: March 15, 2026

Goal:
- Validate the mobile experience opens the definitive `/app/` map flow
- Catch regressions on pins, map behavior, reports, and favorites
- Enforce web non-regression while optimizing mobile UX

## Non-Regression Guardrail (Mandatory)

Every mobile-focused UI change must pass both:

1. Mobile validation
- iPhone target device check on Expo/TestFlight.
- Verify touch gestures (bottom sheet drag, map pan/zoom, CTA taps).

2. Web validation
- Verify desktop browser layout (search/header alignment, map controls, drawer states).
- Verify mobile browser layout (Safari responsive view) for parity.
- Confirm no visual regressions on:
  - bottom sheet open/closed states
  - Leaflet attribution and geolocation button positioning
  - status bar/top overlays

A change is not considered done if mobile improves but web regresses.

## Build Targets

Android (internal APK):
- Use latest EAS artifact URL from build dashboard.

iOS (temporary while Apple team approval is pending):
- Use Expo Go with:
  - `EXPO_PUBLIC_BASE_URL=https://where2beach.com`
  - `EXPO_PUBLIC_APP_ACCESS_KEY=<valid key>`

## Pre-Flight

1. Confirm app opens the map flow directly (no landing screen in app nav).
2. Confirm network is stable (Wi-Fi or 4G/5G).
3. Clear previous app state if behavior looks stale:
   - Expo Go reload, then reopen project.

## Manual Test Cases

1. Map boot
- Steps: Open app and wait initial render.
- Expected: Map visible and pins visible.

2. Pin open/close
- Steps: Tap a pin, open details, close details.
- Expected: Correct beach details; no UI freeze.

3. Show all pins after pin selection (critical regression check)
- Steps: Select one pin, then trigger "mostra tutti i pin", zoom out aggressively.
- Expected: Previously selected pin does not remain incorrectly locked/visible.

4. Search + focus
- Steps: Search a known beach, open it, then reset to all pins.
- Expected: Camera and selected state stay coherent.

5. Report submit
- Steps: Open report modal from a beach and submit valid report.
- Expected: Success state shown; repeated immediate submit shows rate-limit message.

6. Favorites (anonymous)
- Steps: Try favorite action while not logged in.
- Expected: Auth-required prompt appears.

7. Geolocation
- Steps: Grant location and center map around user.
- Expected: Position updates and nearby beaches ordering make sense.

8. Recoverability
- Steps: Toggle network off/on and retry interactions.
- Expected: Graceful error and successful recovery after reconnect.

## Automated Coverage Snapshot (executed locally on March 15, 2026)

- `npm run test:app:map` -> pass
- `npm run test:app:reports` -> pass
- `npm run test:app:auth` -> pass
- `npm run test:app:favorites` -> pass (authenticated branch skipped without test credentials)
- `npm run test:app:gating` -> pass (key/cookie branch skipped when key not set in test env)

## Defect Logging Template

For each issue capture:
- Device + OS version
- Build source (Android APK / iOS Expo Go)
- Steps to reproduce
- Expected result
- Actual result
- Screenshot or screen recording
- Severity: blocker / high / medium / low
