import {
  buildSyncedSeed,
  loadJson,
  loadSeedAndOverrides,
  OUTPUT_PATH,
} from "./lib/sync-utils.mjs";

const ID_PATTERN = /^BR-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/;
const ALLOWED_BASELINE_SOURCES = new Set(["PRED", "LIVE", "RECENT"]);
const ALLOWED_GEO_STATUSES = new Set([
  "override",
  "override_invalid",
  "geocoded",
  "cache",
  "missing",
]);

const ITALY_BOUNDS = {
  minLat: 35.0,
  maxLat: 48.0,
  minLng: 6.0,
  maxLng: 19.0,
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const haversineMeters = (aLat, aLng, bLat, bLng) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(bLat - aLat);
  const deltaLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const findNearDuplicates = (spots, thresholdMeters) => {
  const bucketStep = 0.00025;
  const buckets = new Map();
  const pairs = [];

  const addToBucket = (spot) => {
    const row = Math.floor(spot.lat / bucketStep);
    const col = Math.floor(spot.lng / bucketStep);
    const key = `${row}:${col}`;
    const existing = buckets.get(key) ?? [];
    existing.push(spot);
    buckets.set(key, existing);
  };

  const getNeighbors = (lat, lng) => {
    const row = Math.floor(lat / bucketStep);
    const col = Math.floor(lng / bucketStep);
    const items = [];
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        const entry = buckets.get(`${r}:${c}`);
        if (entry) items.push(...entry);
      }
    }
    return items;
  };

  for (const spot of spots) {
    const nearby = getNeighbors(spot.lat, spot.lng);
    for (const candidate of nearby) {
      if (candidate.id === spot.id) continue;
      if (candidate.id > spot.id) continue;
      const distance = haversineMeters(
        candidate.lat,
        candidate.lng,
        spot.lat,
        spot.lng,
      );
      if (distance <= thresholdMeters) {
        pairs.push({
          idA: candidate.id,
          idB: spot.id,
          meters: Number(distance.toFixed(2)),
        });
      }
    }
    addToBucket(spot);
  }

  return pairs;
};

const main = async () => {
  const errors = [];
  const warnings = [];

  const { seed, overrides } = await loadSeedAndOverrides();
  const { merged, missingIds } = buildSyncedSeed(seed, overrides);

  if (missingIds.length > 0) {
    errors.push(
      `Missing coordinates after merge for ${missingIds.length} entries: ${missingIds.slice(0, 12).join(", ")}`,
    );
  }

  const appData = await loadJson(OUTPUT_PATH, null);
  if (!Array.isArray(appData)) {
    errors.push(`App data file is not a JSON array: ${OUTPUT_PATH}`);
  } else {
    const expected = JSON.stringify(merged);
    const actual = JSON.stringify(appData);
    if (expected !== actual) {
      errors.push(
        `App data is out of sync with seed+overrides. Run: npm run seed:sync`,
      );
    }
  }

  const ids = new Set();
  const coordBuckets = new Map();
  const finiteSpots = [];

  merged.forEach((spot, index) => {
    const ref = `${spot.id ?? `index:${index}`}`;

    if (!isNonEmptyString(spot.id)) {
      errors.push(`Missing id at index ${index}`);
    } else {
      if (!ID_PATTERN.test(spot.id)) {
        errors.push(`Invalid id format: ${spot.id}`);
      }
      if (ids.has(spot.id)) {
        errors.push(`Duplicate id: ${spot.id}`);
      } else {
        ids.add(spot.id);
      }
    }

    if (!isNonEmptyString(spot.name)) errors.push(`Missing name: ${ref}`);
    if (!isNonEmptyString(spot.city)) errors.push(`Missing city: ${ref}`);
    if (!isNonEmptyString(spot.province)) {
      errors.push(`Missing province: ${ref}`);
    } else if (!/^[A-Z]{2,3}$/.test(spot.province.trim())) {
      errors.push(`Invalid province code: ${ref} (${spot.province})`);
    }
    if (!isNonEmptyString(spot.region)) errors.push(`Missing region: ${ref}`);
    if (!isNonEmptyString(spot.address)) warnings.push(`Missing address: ${ref}`);

    const baselineLevel = Number(spot.baselineLevel);
    if (!Number.isInteger(baselineLevel) || baselineLevel < 1 || baselineLevel > 4) {
      errors.push(`Invalid baselineLevel for ${ref}: ${spot.baselineLevel}`);
    }
    if (!ALLOWED_BASELINE_SOURCES.has(String(spot.baselineSource ?? ""))) {
      errors.push(`Invalid baselineSource for ${ref}: ${spot.baselineSource}`);
    }

    const lat = Number(spot.lat);
    const lng = Number(spot.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.push(`Invalid coordinates for ${ref}: ${spot.lat}, ${spot.lng}`);
      return;
    }

    if (
      lat < ITALY_BOUNDS.minLat ||
      lat > ITALY_BOUNDS.maxLat ||
      lng < ITALY_BOUNDS.minLng ||
      lng > ITALY_BOUNDS.maxLng
    ) {
      errors.push(`Coordinates out of expected Italy bounds for ${ref}: ${lat}, ${lng}`);
    }

    const coordKey = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    const collidingIds = coordBuckets.get(coordKey) ?? [];
    collidingIds.push(ref);
    coordBuckets.set(coordKey, collidingIds);
    finiteSpots.push({ id: ref, lat, lng });

    if (!spot.geocodeMeta || typeof spot.geocodeMeta !== "object") {
      errors.push(`Missing geocodeMeta for ${ref}`);
    } else {
      const status = String(spot.geocodeMeta.status ?? "");
      if (status && !ALLOWED_GEO_STATUSES.has(status)) {
        errors.push(`Invalid geocodeMeta.status for ${ref}: ${status}`);
      }
    }
  });

  for (const [coordKey, collidingIds] of coordBuckets.entries()) {
    if (collidingIds.length > 1) {
      errors.push(
        `Duplicate coordinates ${coordKey} used by: ${collidingIds.join(", ")}`,
      );
    }
  }

  const nearDuplicates = findNearDuplicates(finiteSpots, 3.0);
  if (nearDuplicates.length > 0) {
    warnings.push(
      `Found ${nearDuplicates.length} near-duplicate coordinate pairs within 3m. Review suggested.`,
    );
    nearDuplicates.slice(0, 10).forEach((pair) => {
      warnings.push(
        `Near duplicate: ${pair.idA} <-> ${pair.idB} (${pair.meters}m)`,
      );
    });
  }

  console.log(
    `Seed validation summary: rows=${merged.length}, errors=${errors.length}, warnings=${warnings.length}`,
  );
  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (errors.length > 0) {
    console.error("Errors:");
    errors.slice(0, 40).forEach((error) => console.error(`- ${error}`));
    if (errors.length > 40) {
      console.error(`- ...and ${errors.length - 40} more errors`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Seed validation passed.");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
