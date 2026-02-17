# Raw Data Intake

This folder is the canonical intake area for raw datasets used by seed tooling.

## What goes here

- `BeachRadar_*_seed_schema.json`
- `BeachRadar_*_geocoded_schema.json`
- `BeachRadar_*_geocoded_schema.csv`
- `seed-overrides_*_schema.json`
- KML source files under `data/raw/kml/`

## Conventions

- Keep new region/city datasets in `data/raw/` (not in repository root).
- Preserve source filenames to keep provenance clear.
- Use uppercase tokens for override files, e.g. `seed-overrides_RN_RICCIONE_schema.json`.
- The app runtime source of truth remains `src/data/BeachRadar_Rimini_100_geocoded.json`.
