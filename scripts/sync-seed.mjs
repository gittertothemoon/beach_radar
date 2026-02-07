import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.resolve("seed/BeachRadar_Rimini_100_geocoded.json");
const OVERRIDES_PATH = path.resolve("seed/seed-overrides.json");
const OUTPUT_PATH = path.resolve(
  "src/data/BeachRadar_Rimini_100_geocoded.json",
);

const loadJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
};

const saveJson = async (filePath, data) => {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf8");
};

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeGeocodeMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return {
      queryUsed: null,
      fromCache: false,
      place_id: null,
      osm_id: null,
      display_name: null,
    };
  }
  return {
    queryUsed: meta.queryUsed ?? null,
    fromCache: Boolean(meta.fromCache),
    place_id: meta.place_id ?? null,
    osm_id: meta.osm_id ?? null,
    display_name: meta.display_name ?? null,
  };
};

const main = async () => {
  try {
    await fs.access(INPUT_PATH);
  } catch {
    throw new Error(
      `Missing geocoded seed file at ${INPUT_PATH}. Run npm run seed:geocode first.`,
    );
  }
  const seed = await loadJson(INPUT_PATH, []);
  if (!Array.isArray(seed)) {
    throw new Error("Geocoded seed file must contain a JSON array.");
  }

  const overrides = await loadJson(OVERRIDES_PATH, {});
  if (
    overrides === null ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    throw new Error("Overrides file must contain a JSON object.");
  }

  const missingIds = [];
  const merged = seed.map((spot) => {
    const override = overrides[spot.id];
    const next = { ...spot };
    if (override) {
      const lat = toNumber(override.lat);
      const lng = toNumber(override.lng);
      next.lat = Number.isFinite(lat) ? lat : null;
      next.lng = Number.isFinite(lng) ? lng : null;
      next.geocodeMeta = {
        ...normalizeGeocodeMeta(spot.geocodeMeta),
        status: Number.isFinite(lat) && Number.isFinite(lng)
          ? "override"
          : "override_invalid",
        source: override.source ?? "manual",
        note: override.note ?? null,
        queryUsed: "override",
        fromCache: false,
        place_id: null,
        osm_id: null,
        display_name: null,
      };
    } else {
      const lat = toNumber(spot.lat);
      const lng = toNumber(spot.lng);
      next.lat = Number.isFinite(lat) ? lat : null;
      next.lng = Number.isFinite(lng) ? lng : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        next.geocodeMeta = {
          ...normalizeGeocodeMeta(spot.geocodeMeta),
          status: "missing",
        };
      }
    }

    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) {
      missingIds.push(spot.id ?? spot.name ?? "unknown");
    }

    return next;
  });

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await saveJson(OUTPUT_PATH, merged);
  console.log(`Synced seed data to ${OUTPUT_PATH}`);
  if (missingIds.length > 0) {
    console.error(
      `Seed sync failed: missing coords for ${missingIds.length} beaches: ${missingIds.join(", ")}`,
    );
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
