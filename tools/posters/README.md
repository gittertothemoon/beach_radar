# Poster Generator (Where2Beach)

## Prerequisites
- Add the master poster template at: `tools/posters/templates/master.png`

## Commands
```bash
npm run posters:csv
npm run posters:gen
```

## Output
- Posters are written to: `tools/posters/out/`
- `tools/posters/out/` is a generated output directory and is gitignored.

## Validation
- Before generating any PNGs, the script checks that every CSV `beachId` exists in the runtime dataset (`src/data/BeachRadar_Rimini_100_geocoded.json`).
- If any are missing, it prints an error and exits with code 1 (no posters generated).

## Status gating
- Posters are generated only for spots with `status: "pilot"` (or missing status, treated as pilot).
- `draft` spots are for internal testing only and are excluded from posters.

## QR placement tweaks
If the QR does not align, adjust the constants at the top of:
- `tools/posters/generate.mjs`

Current defaults:
- `QR_PLATE = { x: 212, y: 870, w: 600, h: 600, r: 44 }`
- `QR_PADDING = 28`

## Example deeplink
```
https://<tuo-dominio>/?beach=beach-123&src=la-baia-rimini&utm_source=qr&utm_medium=poster&utm_campaign=pilot2026
```

Nota: l'URL base usato dal generatore poster è configurabile via `VITE_PUBLIC_BASE_URL` (o `PUBLIC_BASE_URL`).

## Fast iteration (single poster)
Generate only one poster using:
```bash
POSTER_ONLY_SRC="bagno-xyz" npm run posters:gen
```
