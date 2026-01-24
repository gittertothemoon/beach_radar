# Poster Generator (Beach Radar)

## Prerequisites
- Add the master poster template at: `tools/posters/templates/master.png`

## Commands
```bash
npm run posters:csv
npm run posters:gen
```

## Output
- Posters are written to: `tools/posters/out/`

## QR placement tweaks
If the QR does not align, adjust the constants at the top of:
- `tools/posters/generate.mjs`

Current defaults:
- `QR_PLATE = { x: 212, y: 870, w: 600, h: 600, r: 44 }`
- `QR_PADDING = 28`

## Example deeplink
```
https://beach-radar.vercel.app/?beach=beach-123&src=la-baia-rimini&utm_source=qr&utm_medium=poster&utm_campaign=pilot2026
```

## Fast iteration (single poster)
Generate only one poster using:
```bash
POSTER_ONLY_SRC="bagno-xyz" npm run posters:gen
```
