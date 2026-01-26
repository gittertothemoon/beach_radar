import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_USER_AGENT =
  "BeachRadarSeedGeocoder/1.0 (contact: placeholder@example.com)";
const CONTACT_EMAIL = process.env.NOMINATIM_EMAIL ?? "";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  (CONTACT_EMAIL
    ? `BeachRadarSeedGeocoder/1.0 (contact: ${CONTACT_EMAIL})`
    : DEFAULT_USER_AGENT);
const ACCEPT = "application/json";
const ACCEPT_LANGUAGE = "it";
const REQUEST_DELAY_MS = 1100;
const VIEWBOX = {
  left: 12.1,
  bottom: 44.0,
  right: 12.7,
  top: 44.35,
};
const NOMINATIM_LIMIT = 5;

const SEED_PATH = path.resolve("BeachRadar_Rimini_100_seed_schema.json");
const OUTPUT_JSON = path.resolve("seed/BeachRadar_Rimini_100_geocoded.json");
const OUTPUT_CSV = path.resolve("seed/BeachRadar_Rimini_100_geocoded.csv");
const CACHE_PATH = path.resolve(".cache/nominatim-cache.json");
const OVERRIDES_PATH = path.resolve("seed/seed-overrides.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const fetchCandidatesFromNominatim = async (query) => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(NOMINATIM_LIMIT));
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set(
    "viewbox",
    `${VIEWBOX.left},${VIEWBOX.top},${VIEWBOX.right},${VIEWBOX.bottom}`,
  );
  url.searchParams.set("bounded", "1");
  url.searchParams.set("accept-language", ACCEPT_LANGUAGE);
  if (CONTACT_EMAIL) {
    url.searchParams.set("email", CONTACT_EMAIL);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: ACCEPT,
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        `Nominatim error 403 for ${query}. Set a real contact email with NOMINATIM_EMAIL to comply with usage policy.`,
      );
    }
    throw new Error(`Nominatim error ${response.status} for ${query}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) return [];

  return payload
    .map((item) => ({
      ...item,
      lat: toNumber(item.lat),
      lon: toNumber(item.lon),
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
};

const writeCsv = async (filePath, rows) => {
  const headers = [
    "id",
    "name",
    "address",
    "city",
    "province",
    "region",
    "lat",
    "lng",
    "baselineLevel",
    "baselineSource",
    "notes",
  ];

  const toCsvValue = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes("\"") || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/\"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")].concat(
    rows.map((row) =>
      headers.map((header) => toCsvValue(row[header])).join(","),
    ),
  );

  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
};

const normalizeQueryText = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return text
    .replace(/\([^)]*\)/g, "")
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/&/g, " ")
    .replace(/\s*-\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
};

const simplifyCivic = (value) => {
  if (!value) return "";
  let next = value;
  next = next.replace(/\b(\d+)\s*\/\s*\d+\b/g, "$1");
  next = next.replace(/\b(\d+)\s*-\s*\d+\b/g, "$1");
  next = next.replace(
    /\b(\d+[a-zA-Z0-9\/]*)\s*e\s*(\d+[a-zA-Z0-9\/]*)\b/gi,
    "$1",
  );
  return normalizeQueryText(next);
};

const removeCivic = (value) => {
  if (!value) return "";
  let next = value;
  next = next.replace(/\b(n\.?|nr\.?|numero)\s*\d+[a-zA-Z0-9\/-]*\b/gi, "");
  next = next.replace(/,\s*\d+[a-zA-Z0-9\/-]*\s*(?=(,|$))/g, "");
  if (/arenile demaniale/i.test(next)) {
    next = next.replace(/\s+\d+[a-zA-Z0-9\/-]*$/g, "");
  }
  return normalizeQueryText(next);
};

const normalizeComparison = (value) => {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const PROVINCE_NAMES = {
  RA: "Ravenna",
  RN: "Rimini",
};

const POI_CLASSES = new Set([
  "amenity",
  "tourism",
  "leisure",
  "shop",
  "office",
  "sport",
  "historic",
  "man_made",
]);

const POI_TYPES = new Set([
  "beach",
  "bathing_place",
  "hotel",
  "restaurant",
  "bar",
  "cafe",
  "fast_food",
  "pub",
  "ice_cream",
  "marina",
  "pier",
  "camp_site",
  "swimming_pool",
]);

const GENERIC_CLASSES = new Set(["highway", "boundary", "place"]);
const GENERIC_TYPES = new Set([
  "road",
  "residential",
  "secondary",
  "primary",
  "tertiary",
  "service",
  "footway",
  "path",
  "cycleway",
  "administrative",
  "neighbourhood",
  "suburb",
  "locality",
  "hamlet",
]);

const isWithinViewbox = (lat, lon) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  lat >= VIEWBOX.bottom &&
  lat <= VIEWBOX.top &&
  lon >= VIEWBOX.left &&
  lon <= VIEWBOX.right;

const scoreCandidate = (candidate, spot) => {
  let score = 0;
  const lat = toNumber(candidate.lat);
  const lon = toNumber(candidate.lon);

  if (isWithinViewbox(lat, lon)) {
    score += 3;
  } else {
    score -= 1;
  }

  const classValue = (candidate.class ?? "").toLowerCase();
  const typeValue = (candidate.type ?? "").toLowerCase();

  if (POI_CLASSES.has(classValue)) score += 2;
  if (POI_TYPES.has(typeValue)) score += 2;
  if (GENERIC_CLASSES.has(classValue)) score -= 1;
  if (GENERIC_TYPES.has(typeValue)) score -= 1;

  const displayName = normalizeComparison(candidate.display_name ?? "");
  const spotName = normalizeComparison(spot.name ?? "");
  if (spotName && displayName.includes(spotName)) score += 1;

  const spotCity = normalizeComparison(spot.city ?? "");
  const address = candidate.address ?? {};
  const addressCities = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.suburb,
    address.neighbourhood,
    address.hamlet,
  ]
    .map(normalizeComparison)
    .filter(Boolean);
  if (
    spotCity &&
    addressCities.some(
      (value) => value === spotCity || value.includes(spotCity),
    )
  ) {
    score += 3;
  }

  const provinceCode = (spot.province ?? "").toUpperCase();
  const provinceName = PROVINCE_NAMES[provinceCode];
  const provinceNeedles = [provinceCode, provinceName]
    .filter(Boolean)
    .map(normalizeComparison);
  const provinceHay = [
    address.county,
    address.state,
    address.region,
    candidate.display_name,
  ]
    .map(normalizeComparison)
    .filter(Boolean);

  if (
    provinceNeedles.length > 0 &&
    provinceNeedles.some((needle) =>
      provinceHay.some((value) => value.includes(needle)),
    )
  ) {
    score += 2;
  }

  return score;
};

const pickBestCandidate = (candidates, spot) => {
  if (!candidates.length) return null;
  const scored = candidates.map((candidate, index) => ({
    candidate,
    index,
    score: scoreCandidate(candidate, spot),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  return scored[0]?.candidate ?? null;
};

const toResult = (candidate) => {
  if (!candidate) return null;
  const lat = toNumber(candidate.lat);
  const lon = toNumber(candidate.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    display_name: candidate.display_name ?? "",
    place_id: candidate.place_id ?? null,
    osm_id: candidate.osm_id ?? null,
  };
};

const normalizeCachedResult = (cached) => {
  if (!cached || typeof cached !== "object") return null;
  const lat = toNumber(cached.lat);
  const lon = toNumber(cached.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    display_name: cached.display_name ?? "",
    place_id: cached.place_id ?? null,
    osm_id: cached.osm_id ?? null,
  };
};

const parseOverride = (override) => {
  if (!override || typeof override !== "object") return null;
  const lat = toNumber(override.lat);
  const lng = toNumber(override.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    source: override.source ?? "manual",
    note: override.note ?? null,
  };
};

const buildQueries = (spot) => {
  const queries = [];
  const address = spot.address ? normalizeQueryText(spot.address) : "";
  if (address) queries.push(address);

  const simplifiedAddress = address ? simplifyCivic(address) : "";
  if (simplifiedAddress && simplifiedAddress !== address) {
    queries.push(simplifiedAddress);
  }

  const withoutCivic = address ? removeCivic(address) : "";
  if (
    withoutCivic &&
    withoutCivic !== address &&
    withoutCivic !== simplifiedAddress
  ) {
    queries.push(withoutCivic);
  }

  if (spot.name && spot.city && spot.province) {
    queries.push(
      normalizeQueryText(`${spot.name}, ${spot.city}, ${spot.province}, Italia`),
    );
  }

  const addressHasArenile = /arenile demaniale/i.test(address);
  const cityIsCerviaOrPinarella = /cervia|pinarella/i.test(spot.city ?? "");
  if (spot.name && (addressHasArenile || cityIsCerviaOrPinarella)) {
    queries.push(
      normalizeQueryText(`${spot.name}, Pinarella di Cervia, Italia`),
    );
  }

  const cityIsRimini = /rimini/i.test(spot.city ?? "");
  if (spot.name && (cityIsRimini || /rimini/i.test(address))) {
    queries.push(normalizeQueryText(`${spot.name}, Rimini, Italia`));
  }

  const unique = [];
  const seen = new Set();
  for (const query of queries) {
    const normalized = query.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(query);
  }
  return unique;
};

const main = async () => {
  const seed = await loadJson(SEED_PATH, []);
  if (!Array.isArray(seed)) {
    throw new Error("Seed file must contain a JSON array.");
  }

  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });

  const cache = await loadJson(CACHE_PATH, {});
  const overrides = await loadJson(OVERRIDES_PATH, {});
  if (
    overrides === null ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    throw new Error("Overrides file must contain a JSON object.");
  }
  let lastRequestAt = 0;

  const stats = {
    total: seed.length,
    ok: 0,
    failed: 0,
    from_cache: 0,
    overrides: 0,
    nominatim: 0,
  };

  const geocodeQuery = async (query, spot) => {
    if (Object.prototype.hasOwnProperty.call(cache, query)) {
      const cachedResult = normalizeCachedResult(cache[query]);
      if (cachedResult) {
        return { result: cachedResult, fromCache: true };
      }
    }

    const now = Date.now();
    const waitMs = Math.max(0, REQUEST_DELAY_MS - (now - lastRequestAt));
    if (waitMs > 0) await sleep(waitMs);

    const candidates = await fetchCandidatesFromNominatim(query);
    const selected = pickBestCandidate(candidates, spot);
    const result = toResult(selected);
    if (result) {
      cache[query] = result;
      await saveJson(CACHE_PATH, cache);
    } else if (Object.prototype.hasOwnProperty.call(cache, query)) {
      delete cache[query];
      await saveJson(CACHE_PATH, cache);
    }
    lastRequestAt = Date.now();

    return { result, fromCache: false };
  };

  const enriched = [];
  const failedIds = [];

  for (const spot of seed) {
    const existingLat = toNumber(spot.lat);
    const existingLng = toNumber(spot.lng);
    let lat = existingLat;
    let lng = existingLng;
    let notes = spot.notes ?? "";

    let usedCacheForResult = false;
    let lastQuery = null;
    let lastQueryFromCache = false;
    let geocodeMeta = {
      queryUsed: null,
      fromCache: false,
      place_id: null,
      osm_id: null,
      display_name: null,
    };

    const override = overrides[spot.id];
    if (override) {
      const parsedOverride = parseOverride(override);
      if (parsedOverride) {
        lat = parsedOverride.lat;
        lng = parsedOverride.lng;
      } else {
        lat = null;
        lng = null;
      }
      geocodeMeta = {
        queryUsed: "override",
        fromCache: false,
        place_id: null,
        osm_id: null,
        display_name: null,
        status: parsedOverride ? "override" : "override_invalid",
        source: override.source ?? "manual",
        note: override.note ?? null,
      };
    } else if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      let result = null;
      const queries = buildQueries(spot);
      for (const query of queries) {
        const response = await geocodeQuery(query, spot);
        lastQuery = query;
        lastQueryFromCache = response.fromCache;
        result = response.result;
        if (result) {
          usedCacheForResult = response.fromCache;
          geocodeMeta = {
            queryUsed: query,
            fromCache: response.fromCache,
            place_id: result.place_id ?? null,
            osm_id: result.osm_id ?? null,
            display_name: result.display_name ?? "",
            status: "geocoded",
          };
          break;
        }
      }

      if (result) {
        lat = result.lat;
        lng = result.lon;
      } else if (lastQuery) {
        geocodeMeta = {
          queryUsed: lastQuery,
          fromCache: lastQueryFromCache,
          place_id: null,
          osm_id: null,
          display_name: null,
          status: "missing",
        };
      }
    }

    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    if (ok) {
      stats.ok += 1;
      if (override && geocodeMeta.status === "override") {
        stats.overrides += 1;
      }
      if (geocodeMeta.status === "geocoded") {
        stats.nominatim += 1;
      }
      if (notes.includes("GEOCODE_FAILED")) {
        notes = notes.replace(/\s*GEOCODE_FAILED\s*/g, " ").trim();
      }
    } else {
      stats.failed += 1;
      const flag = "GEOCODE_FAILED";
      notes = notes.includes(flag) ? notes : `${notes} ${flag}`.trim();
      lat = null;
      lng = null;
      failedIds.push(spot.id ?? spot.name ?? "unknown");
    }

    if (ok && usedCacheForResult) {
      stats.from_cache += 1;
    }

    enriched.push({
      ...spot,
      lat,
      lng,
      notes,
      geocodeMeta,
    });
  }

  await saveJson(OUTPUT_JSON, enriched);
  await writeCsv(OUTPUT_CSV, enriched);

  // eslint-disable-next-line no-console
  console.log(
    `Geocode summary: total=${stats.total} ok=${stats.ok} failed=${stats.failed} from_cache=${stats.from_cache} overrides=${stats.overrides}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Geocode sources: overrides=${stats.overrides} nominatim=${stats.nominatim} cache=${stats.from_cache}`,
  );
  if (failedIds.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Failed IDs (${failedIds.length}): ${failedIds.join(", ")}`);
  } else {
    // eslint-disable-next-line no-console
    console.log("Failed IDs (0): none");
  }
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
