#!/usr/bin/env node
// Ingest Bandiere Blu 2025 (FEE Italia) beaches into
// src/data/BeachRadar_Rimini_100_geocoded.json.
//
// Pipeline:
//   1. Load BB canonical list + OSM corpus + Wikidata corpus + existing DB.
//   2. For each BB beach, resolve coordinates with multi-source matching:
//      a. Resolve comune centroid via Nominatim (cached).
//      b. Score OSM candidates within 5km by token overlap with beach name.
//      c. Score Wikidata candidates likewise.
//      d. Pick the best-scoring coord (OSM way preferred > OSM node > Wikidata).
//      e. Fallback to Nominatim forward geocode when all else fails.
//   3. Dedup vs existing DB (150 m haversine).
//   4. Emit BR-{PROV}-BB-{NNN} entries with geocodeMeta.sources=[…].
//   5. Write review.csv for entries with low confidence.
//
// Caches (all resumable):
//   .cache/osm-beaches-italy.json          (Overpass result, prefetched)
//   .cache/wikidata-beaches-italy.json     (SPARQL result, prefetched)
//   .cache/nominatim-reverse-cache.json    (reverse geocodes)
//   .cache/nominatim-forward-cache.json    (forward geocodes)

import fs from "node:fs/promises";
import path from "node:path";

// ---------- Paths & config ----------

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);
const BB_PATH = path.join(ROOT, "data/raw/bandiere-blu-2025.json");
const OSM_PATH = path.join(ROOT, ".cache/osm-beaches-italy.json");
const OSM_UNNAMED_PATH = path.join(
  ROOT,
  ".cache/osm-beaches-italy-unnamed.json",
);
const WIKIDATA_PATH = path.join(ROOT, ".cache/wikidata-beaches-italy.json");
const GEOCODED_PATH = path.join(
  ROOT,
  "src/data/BeachRadar_Rimini_100_geocoded.json",
);
const GEOCODED_MIRROR_PATH = path.join(
  ROOT,
  "seed/BeachRadar_Rimini_100_geocoded.json",
);
const NOMINATIM_FWD_CACHE = path.join(
  ROOT,
  ".cache/nominatim-forward-cache.json",
);
const NOMINATIM_REV_CACHE = path.join(
  ROOT,
  ".cache/nominatim-reverse-cache.json",
);
const REPORT_PATH = path.join(ROOT, ".cache/bb-ingest-report.json");
const REVIEW_CSV_PATH = path.join(ROOT, ".cache/bb-ingest-review.csv");
const TRACE_PATH = path.join(ROOT, ".cache/bb-ingest-trace.jsonl");

const CONTACT_EMAIL = process.env.NOMINATIM_EMAIL ?? "contact@where2beach.app";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  `Where2BeachBBIngest/1.0 (contact: ${CONTACT_EMAIL})`;
const NOMINATIM_DELAY_MS = 1100;

const DEDUP_METERS = 150;
const MATCH_RADIUS_M = 5000;

// Province code mapping (ISO 3166-2:IT uses 2-letter codes for all provinces).
// We populate via Nominatim reverse ISO3166-2-lvl6. This is just a sanity map
// used when Nominatim is unavailable or to assign fallback codes for
// well-known comuni that lack the ISO code in the response.
const COMUNE_PROVINCE_FALLBACK = {
  // populated lazily via Nominatim; kept empty here
};

// ---------- Tiny helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loadJson = async (p, fallback) => {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
};

const saveJson = async (p, data) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const haversineMeters = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const c = s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
};

const normalizeText = (value) => {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const STOPWORDS = new Set([
  "di", "del", "della", "delle", "dei", "degli", "da",
  "la", "il", "lo", "gli", "le", "un", "una", "uno",
  "spiaggia", "spiagge", "lido", "litorale", "bagni",
  "baia", "cala", "arenile", "lungomare", "porto",
]);

const tokenize = (value) => {
  const norm = normalizeText(value);
  if (!norm) return [];
  return norm.split(" ").filter((t) => t.length > 0 && !STOPWORDS.has(t));
};

// Jaccard-like similarity for token sets.
const tokenOverlap = (a, b) => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  return inter / Math.max(setA.size, setB.size);
};

// ---------- Corpora loaders ----------

const loadBB = async () => {
  const bb = await loadJson(BB_PATH, null);
  if (!bb) throw new Error("Bandiere Blu JSON not found at " + BB_PATH);
  const flat = [];
  for (const [region, rdata] of Object.entries(bb.regions)) {
    const isLake = Boolean(rdata.lake);
    for (const [comune, beaches] of Object.entries(rdata.comuni)) {
      for (const beachName of beaches) {
        flat.push({ region, comune, beachName, isLake });
      }
    }
  }
  return flat;
};

const loadOsmIndex = async () => {
  const osm = await loadJson(OSM_PATH, null);
  if (!osm?.elements?.length)
    throw new Error("OSM cache missing. Prefetch Overpass first.");
  const items = [];
  for (const el of osm.elements) {
    const coord =
      el.type === "node"
        ? { lat: el.lat, lng: el.lon }
        : el.center
          ? { lat: el.center.lat, lng: el.center.lon }
          : null;
    if (!coord) continue;
    const name = el.tags?.name ?? null;
    if (!name) continue;
    items.push({
      source: "OSM",
      type: el.type,
      id: el.id,
      name,
      lat: coord.lat,
      lng: coord.lng,
      tokens: tokenize(name),
    });
  }
  return items;
};

const loadOsmUnnamedIndex = async () => {
  const osm = await loadJson(OSM_UNNAMED_PATH, null);
  if (!osm?.elements?.length) return [];
  const items = [];
  for (const el of osm.elements) {
    const coord =
      el.type === "node"
        ? { lat: el.lat, lng: el.lon }
        : el.center
          ? { lat: el.center.lat, lng: el.center.lon }
          : null;
    if (!coord) continue;
    items.push({
      source: "OSM",
      type: el.type,
      id: el.id,
      name: null,
      lat: coord.lat,
      lng: coord.lng,
      tokens: [],
    });
  }
  return items;
};

const loadWikidataIndex = async () => {
  const wd = await loadJson(WIKIDATA_PATH, null);
  if (!wd?.results?.bindings?.length) return [];
  const items = [];
  for (const b of wd.results.bindings) {
    const name = b.beachLabel?.value ?? null;
    const coordStr = b.coord?.value;
    if (!name || !coordStr) continue;
    const m = /^Point\(([-\d.]+)\s+([-\d.]+)\)$/.exec(coordStr);
    if (!m) continue;
    const lng = parseFloat(m[1]);
    const lat = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    items.push({
      source: "WIKIDATA",
      type: "node",
      id: b.beach?.value?.split("/").pop(),
      name,
      lat,
      lng,
      tokens: tokenize(name),
    });
  }
  return items;
};

// ---------- Grid index ----------

const buildGridIndex = (items, cellSize = 0.05) => {
  // cellSize ~5km latitude at 0.05, ~500m at 0.005.
  const grid = new Map();
  const cellKey = (lat, lng) =>
    `${Math.floor(lat / cellSize)}:${Math.floor(lng / cellSize)}`;
  const add = (it) => {
    const k = cellKey(it.lat, it.lng);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(it);
  };
  for (const it of items) add(it);
  return {
    add,
    near(center, radiusMeters) {
      const bx = Math.floor(center.lat / cellSize);
      const by = Math.floor(center.lng / cellSize);
      const spread = Math.max(1, Math.ceil(radiusMeters / (cellSize * 111000)));
      const out = [];
      for (let dx = -spread; dx <= spread; dx++) {
        for (let dy = -spread; dy <= spread; dy++) {
          const list = grid.get(`${bx + dx}:${by + dy}`);
          if (list) out.push(...list);
        }
      }
      return out.filter((it) => haversineMeters(center, it) <= radiusMeters);
    },
  };
};

// ---------- Nominatim ----------

const nomCache = {
  fwd: null,
  rev: null,
  lastRequestAt: 0,
  lastSaveAt: 0,
};

const loadNomCaches = async () => {
  nomCache.fwd = await loadJson(NOMINATIM_FWD_CACHE, {});
  nomCache.rev = await loadJson(NOMINATIM_REV_CACHE, {});
};

const persistNomCaches = async (force = false) => {
  const now = Date.now();
  if (!force && now - nomCache.lastSaveAt < 5000) return;
  await saveJson(NOMINATIM_FWD_CACHE, nomCache.fwd);
  await saveJson(NOMINATIM_REV_CACHE, nomCache.rev);
  nomCache.lastSaveAt = now;
};

const nominatimRateLimit = async () => {
  const now = Date.now();
  const wait = Math.max(
    0,
    NOMINATIM_DELAY_MS - (now - nomCache.lastRequestAt),
  );
  if (wait > 0) await sleep(wait);
  nomCache.lastRequestAt = Date.now();
};

const nominatimForward = async (query) => {
  if (Object.prototype.hasOwnProperty.call(nomCache.fwd, query)) {
    return nomCache.fwd[query];
  }
  await nominatimRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set("accept-language", "it");
  if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Nominatim forward ${res.status} for ${query}`);
  }
  const results = await res.json();
  nomCache.fwd[query] = results;
  await persistNomCaches(false);
  return results;
};

const nominatimReverse = async (lat, lng) => {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (Object.prototype.hasOwnProperty.call(nomCache.rev, key)) {
    return nomCache.rev[key];
  }
  await nominatimRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "it");
  if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Nominatim reverse ${res.status} at ${key}`);
  }
  const json = await res.json();
  nomCache.rev[key] = json;
  await persistNomCaches(false);
  return json;
};

// ---------- Resolution ----------

const REGION_TO_CODE = {
  Abruzzo: "ABR",
  Basilicata: "BAS",
  Calabria: "CAL",
  Campania: "CAM",
  "Emilia-Romagna": "EMR",
  "Friuli-Venezia Giulia": "FVG",
  Lazio: "LAZ",
  Liguria: "LIG",
  Lombardia: "LOM",
  Marche: "MAR",
  Molise: "MOL",
  Piemonte: "PIE",
  Puglia: "PUG",
  Sardegna: "SAR",
  Sicilia: "SIC",
  Toscana: "TOS",
  "Trentino-Alto Adige": "TAA",
  Umbria: "UMB",
  "Valle d'Aosta": "VDA",
  "Valle d’Aosta": "VDA",
  Veneto: "VEN",
};

const extractProvinceAndCity = (reverse) => {
  const addr = reverse?.address;
  if (!addr) return null;
  const isoCounty = addr["ISO3166-2-lvl6"];
  const provinceCode =
    typeof isoCounty === "string" && isoCounty.startsWith("IT-")
      ? isoCounty.slice(3).toUpperCase()
      : null;
  const city =
    addr.city ??
    addr.town ??
    addr.village ??
    addr.municipality ??
    addr.hamlet ??
    addr.suburb ??
    null;
  const state = addr.state ?? null;
  return { provinceCode, city, state };
};

const resolveComuneCentroid = async (comune, region) => {
  const query = `${comune}, ${region}, Italia`;
  const results = await nominatimForward(query);
  if (!Array.isArray(results) || results.length === 0) return null;
  const chosen =
    results.find(
      (r) =>
        r.class === "boundary" ||
        r.addresstype === "municipality" ||
        r.addresstype === "city" ||
        r.addresstype === "town" ||
        r.addresstype === "village",
    ) ?? results[0];
  const lat = parseFloat(chosen.lat);
  const lng = parseFloat(chosen.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, display_name: chosen.display_name };
};

const scoreCandidate = (candidate, beachTokens, centroid) => {
  const nameSim = tokenOverlap(candidate.tokens, beachTokens);
  const dist = haversineMeters(centroid, candidate);
  const distScore = Math.max(0, 1 - dist / MATCH_RADIUS_M);
  let typeBonus = 0;
  if (candidate.source === "OSM" && candidate.type === "way") typeBonus = 0.2;
  else if (candidate.source === "OSM" && candidate.type === "node")
    typeBonus = 0.1;
  return nameSim * 0.65 + distScore * 0.2 + typeBonus;
};

const pickBestCandidate = (candidates, beachTokens, centroid) => {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => ({
    candidate: c,
    score: scoreCandidate(c, beachTokens, centroid),
    nameSim: tokenOverlap(c.tokens, beachTokens),
    dist: haversineMeters(centroid, c),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
};

// ---------- Main ----------

const slugComune = (s) =>
  normalizeText(s).replace(/\s+/g, "").slice(0, 6).toUpperCase() || "BB";

const buildId = (provinceCode, counter) => {
  const seq = counter.next(provinceCode);
  return `BR-${provinceCode}-BB-${seq}`;
};

const allocateCounters = (existing) => {
  const maxByProvince = {};
  for (const b of existing) {
    const m = /^BR-([A-Z]+)-BB-(\d+)$/.exec(b.id ?? "");
    if (!m) continue;
    const n = parseInt(m[2], 10);
    if (!maxByProvince[m[1]] || n > maxByProvince[m[1]])
      maxByProvince[m[1]] = n;
  }
  return {
    next(province) {
      const cur = maxByProvince[province] ?? 0;
      maxByProvince[province] = cur + 1;
      return String(cur + 1).padStart(3, "0");
    },
  };
};

const main = async () => {
  const bbList = await loadBB();
  const osmItems = await loadOsmIndex();
  const osmUnnamed = await loadOsmUnnamedIndex();
  const wdItems = await loadWikidataIndex();
  const existing = await loadJson(GEOCODED_PATH, []);
  if (!Array.isArray(existing))
    throw new Error("geocoded JSON must be an array");
  await loadNomCaches();

  console.log(
    `[load] bb=${bbList.length} osm-named=${osmItems.length} osm-unnamed=${osmUnnamed.length} wd=${wdItems.length} existing=${existing.length}`,
  );

  const osmGrid = buildGridIndex(osmItems, 0.05);
  const osmAllGrid = buildGridIndex([...osmItems, ...osmUnnamed], 0.05);
  const wdGrid = buildGridIndex(wdItems, 0.05);

  const existingGrid = buildGridIndex(
    existing
      .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
      .map((b) => ({ lat: b.lat, lng: b.lng, id: b.id })),
    0.005,
  );

  const counter = allocateCounters(existing);
  const newEntries = [];
  const reviews = [];
  const stats = {
    total: bbList.length,
    resolved_high: 0,
    resolved_medium: 0,
    resolved_low: 0,
    held_for_review: 0,
    dedupe_dropped: 0,
    coord_collision: 0,
    unresolved: 0,
    errors: 0,
  };

  // Within-run coord bucket: a BB entry that resolves to the *same pin
  // coordinate* (within 20 m) as a previously-emitted BB entry from the
  // same run is held for review. This prevents pin overlap when multiple
  // BB-awarded beach sectors in a comune collapse to a single fallback.
  const emittedGrid = new Map();
  const emittedCellSize = 0.0002; // ~22m
  const emittedKey = (lat, lng) =>
    `${Math.floor(lat / emittedCellSize)}:${Math.floor(lng / emittedCellSize)}`;
  const hasCoordCollision = (lat, lng) => {
    const bx = Math.floor(lat / emittedCellSize);
    const by = Math.floor(lng / emittedCellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = emittedGrid.get(`${bx + dx}:${by + dy}`);
        if (!list) continue;
        for (const p of list) {
          if (haversineMeters({ lat, lng }, p) < 30) return p;
        }
      }
    }
    return null;
  };
  const markEmitted = (lat, lng, id) => {
    const k = emittedKey(lat, lng);
    if (!emittedGrid.has(k)) emittedGrid.set(k, []);
    emittedGrid.get(k).push({ lat, lng, id });
  };

  const LIMIT = process.env.BB_LIMIT ? parseInt(process.env.BB_LIMIT, 10) : null;
  const REGION_FILTER = process.env.BB_REGION ?? null;
  const DRY_RUN = process.env.BB_DRY_RUN === "1";

  // Open trace file fresh each run
  const traceHandle = await fs.open(TRACE_PATH, "w");
  const writeTrace = async (obj) =>
    traceHandle.write(JSON.stringify(obj) + "\n");

  let index = 0;
  for (const bb of bbList) {
    index++;
    if (REGION_FILTER && bb.region !== REGION_FILTER) continue;
    if (LIMIT && index > LIMIT) break;
    if (index % 25 === 0) {
      console.log(
        `[bb] ${index}/${bbList.length} resolved=${newEntries.length} unresolved=${stats.unresolved}`,
      );
      await persistNomCaches(true);
    }

    try {
      const centroid = await resolveComuneCentroid(bb.comune, bb.region);
      if (!centroid) {
        stats.unresolved++;
        reviews.push({
          ...bb,
          reason: "no_comune_centroid",
          confidence: "none",
          lat: null,
          lng: null,
        });
        continue;
      }

      const beachTokens = tokenize(bb.beachName);
      const osmCands = osmGrid.near(centroid, MATCH_RADIUS_M);
      const osmAllCands = osmAllGrid.near(centroid, MATCH_RADIUS_M);
      const wdCands = wdGrid.near(centroid, MATCH_RADIUS_M);
      const osmBest = pickBestCandidate(osmCands, beachTokens, centroid);
      const wdBest = pickBestCandidate(wdCands, beachTokens, centroid);
      // Nearest beach (any name, including unnamed polygons) — proximity-only
      // fallback when name matching fails.
      const osmAnyNearest = osmAllCands
        .map((c) => ({
          candidate: c,
          dist: haversineMeters(centroid, c),
        }))
        .sort((a, b) => a.dist - b.dist)[0] ?? null;

      let chosen = null;
      let confidence = "fallback";
      let pathTaken = "none";
      const sources = [];

      const BEACHY_NOMINATIM_CLASSES = new Set([
        "leisure",
        "natural",
        "tourism",
        "waterway",
      ]);
      const BEACHY_NOMINATIM_TYPES = new Set([
        "beach",
        "beach_resort",
        "swimming_area",
        "bay",
        "cape",
        "peninsula",
        "coastline",
      ]);

      // Resolve Nominatim fallback once (used by multiple branches below).
      const fallbackQuery = `${bb.beachName}, ${bb.comune}, Italia`;
      let fallbackResults = [];
      try {
        fallbackResults = await nominatimForward(fallbackQuery);
      } catch (_err) {
        // ignore, treat as empty
      }
      const fallback = fallbackResults?.[0];
      const fbLat = fallback ? parseFloat(fallback.lat) : NaN;
      const fbLng = fallback ? parseFloat(fallback.lon) : NaN;
      const fbInRange =
        Number.isFinite(fbLat) &&
        Number.isFinite(fbLng) &&
        haversineMeters(centroid, { lat: fbLat, lng: fbLng }) <= MATCH_RADIUS_M;
      const fbClass = fallback?.class ?? "";
      const fbType = fallback?.type ?? "";
      const fbIsBeachy =
        fbInRange &&
        (BEACHY_NOMINATIM_CLASSES.has(fbClass) ||
          BEACHY_NOMINATIM_TYPES.has(fbType));

      // 1. Strong OSM name match (token overlap >= 0.5). Best quality.
      if (osmBest && osmBest.nameSim >= 0.5) {
        chosen = osmBest.candidate;
        confidence = osmBest.candidate.type === "way" ? "high" : "medium";
        pathTaken = `osm_${osmBest.candidate.type}_namesim_${osmBest.nameSim.toFixed(2)}`;
        sources.push("BANDIERA_BLU_2025");
        sources.push(
          osmBest.candidate.type === "way" ? "OSM_WAY" : "OSM_NODE",
        );
        if (wdBest && wdBest.nameSim >= 0.5) sources.push("WIKIDATA");
      }
      // 2. Strong Wikidata name match
      else if (wdBest && wdBest.nameSim >= 0.5) {
        chosen = wdBest.candidate;
        confidence = "medium";
        pathTaken = `wikidata_namesim_${wdBest.nameSim.toFixed(2)}`;
        sources.push("BANDIERA_BLU_2025", "WIKIDATA");
        if (osmBest) sources.push("OSM_NEARBY");
      }
      // 3. Nominatim returned a beach-like entity ("beach", "bay",
      //    "beach_resort", "cape"…) — high semantic value.
      else if (fbIsBeachy) {
        chosen = { lat: fbLat, lng: fbLng, name: bb.beachName };
        confidence = "medium";
        pathTaken = `nominatim_forward_beachy:${fbClass}:${fbType}`;
        sources.push("BANDIERA_BLU_2025", "NOMINATIM_FORWARD");
      }
      // 4. OSM has a beach near the comune. Even if names don't match and
      //    it's up to ~4 km from the centroid, a pin on a real beach is
      //    better than the town's admin centroid.
      else if (osmBest && osmBest.dist < 4000) {
        chosen = osmBest.candidate;
        confidence = osmBest.dist < 1500 ? "medium" : "low";
        pathTaken = `osm_nearest_dist_${Math.round(osmBest.dist)}m`;
        sources.push("BANDIERA_BLU_2025");
        sources.push(
          osmBest.candidate.type === "way" ? "OSM_WAY_NEAR" : "OSM_NODE_NEAR",
        );
      }
      // 5. Nominatim returned something in range but not beach-like
      //    (square, pedestrian, hamlet…). Often still a coastal landmark.
      else if (fbInRange) {
        chosen = { lat: fbLat, lng: fbLng, name: bb.beachName };
        confidence = "low";
        pathTaken = `nominatim_forward_generic:${fbClass}:${fbType}`;
        sources.push("BANDIERA_BLU_2025", "NOMINATIM_FORWARD");
      }
      // 6. ANY OSM beach polygon (including unnamed) within 5km of the
      //    comune centroid. The pin lands on a genuine beach; the exact
      //    named sector is uncertain so confidence=low.
      else if (osmAnyNearest && osmAnyNearest.dist < 5000) {
        chosen = osmAnyNearest.candidate;
        confidence = "low";
        pathTaken = `osm_any_nearest_dist_${Math.round(osmAnyNearest.dist)}m`;
        sources.push("BANDIERA_BLU_2025", "OSM_UNNAMED_NEAR");
      }
      // 7. Comune centroid. Lowest quality — pin in town center, not on
      //    beach. Held back from the DB by default (emitted only with
      //    BB_INCLUDE_FALLBACK=1) so Ivan can manually verify.
      else {
        chosen = { lat: centroid.lat, lng: centroid.lng, name: bb.beachName };
        confidence = "fallback";
        pathTaken = "comune_centroid";
        sources.push("BANDIERA_BLU_2025", "COMUNE_CENTROID");
      }

      if (!chosen) {
        stats.unresolved++;
        reviews.push({
          ...bb,
          reason: "no_match_found",
          confidence: "none",
          pathTaken,
          lat: null,
          lng: null,
        });
        continue;
      }

      // Dedup vs existing DB
      const nearExisting = existingGrid.near(chosen, DEDUP_METERS);
      if (nearExisting.length > 0) {
        stats.dedupe_dropped++;
        reviews.push({
          ...bb,
          reason: "duplicate_of_existing",
          confidence,
          lat: chosen.lat,
          lng: chosen.lng,
          duplicateOf: nearExisting[0].id,
        });
        continue;
      }

      // Enrich with province/city from reverse geocode
      const reverse = await nominatimReverse(chosen.lat, chosen.lng);
      const addrInfo = extractProvinceAndCity(reverse);
      if (!addrInfo?.provinceCode) {
        stats.unresolved++;
        reviews.push({
          ...bb,
          reason: "no_province_from_reverse",
          confidence,
          lat: chosen.lat,
          lng: chosen.lng,
        });
        continue;
      }

      const province = addrInfo.provinceCode;
      const INCLUDE_FALLBACK = process.env.BB_INCLUDE_FALLBACK === "1";

      if (confidence === "fallback" && !INCLUDE_FALLBACK) {
        stats.held_for_review++;
        reviews.push({
          ...bb,
          reason: "fallback_comune_centroid",
          confidence,
          pathTaken,
          lat: Number(chosen.lat.toFixed(7)),
          lng: Number(chosen.lng.toFixed(7)),
          province,
        });
        await writeTrace({
          region: bb.region,
          comune: bb.comune,
          beachName: bb.beachName,
          confidence,
          pathTaken,
          id: null,
          province,
          lat: Number(chosen.lat.toFixed(7)),
          lng: Number(chosen.lng.toFixed(7)),
          held: true,
          osmBestNameSim: osmBest?.nameSim ?? null,
          osmBestDist: osmBest ? Math.round(osmBest.dist) : null,
          wdBestNameSim: wdBest?.nameSim ?? null,
        });
        continue;
      }

      // Detect collision with a previously-emitted BB entry at the same coord.
      const collision = hasCoordCollision(chosen.lat, chosen.lng);
      if (collision) {
        stats.coord_collision++;
        reviews.push({
          ...bb,
          reason: `coord_collision_with_${collision.id}`,
          confidence,
          pathTaken,
          lat: Number(chosen.lat.toFixed(7)),
          lng: Number(chosen.lng.toFixed(7)),
          province,
          duplicateOf: collision.id,
        });
        await writeTrace({
          region: bb.region,
          comune: bb.comune,
          beachName: bb.beachName,
          confidence,
          pathTaken,
          id: null,
          province,
          lat: Number(chosen.lat.toFixed(7)),
          lng: Number(chosen.lng.toFixed(7)),
          held: true,
          collidedWith: collision.id,
        });
        continue;
      }

      const id = buildId(province, counter);
      const name = bb.beachName.trim();
      const address = [bb.comune, province, "Italia"].filter(Boolean).join(", ");

      const entry = {
        id,
        name,
        address,
        city: bb.comune,
        province,
        region: bb.region,
        baselineLevel: 3,
        baselineSource: "BANDIERA_BLU",
        lat: Number(chosen.lat.toFixed(7)),
        lng: Number(chosen.lng.toFixed(7)),
        notes: "",
        geocodeMeta: {
          queryUsed: `bb:${bb.comune}:${bb.beachName}`,
          fromCache: false,
          place_id: null,
          osm_id: chosen.id ?? null,
          display_name: null,
          status: "bb_import",
          source: "BANDIERA_BLU_2025",
          note: null,
          sources,
          confidence,
          bandieraBlu: true,
          beachOriginalName: bb.beachName,
        },
      };

      newEntries.push(entry);
      markEmitted(chosen.lat, chosen.lng, id);

      await writeTrace({
        region: bb.region,
        comune: bb.comune,
        beachName: bb.beachName,
        confidence,
        pathTaken,
        id,
        province,
        lat: entry.lat,
        lng: entry.lng,
        osmBestNameSim: osmBest?.nameSim ?? null,
        osmBestDist: osmBest ? Math.round(osmBest.dist) : null,
        wdBestNameSim: wdBest?.nameSim ?? null,
      });

      if (confidence === "high") stats.resolved_high++;
      else if (confidence === "medium") stats.resolved_medium++;
      else stats.resolved_low++;
    } catch (err) {
      stats.errors++;
      console.warn(`[bb] error for ${bb.region}/${bb.comune}/${bb.beachName}:`, err.message);
      reviews.push({
        ...bb,
        reason: `error:${err.message}`,
        confidence: "none",
        lat: null,
        lng: null,
      });
    }
  }

  await traceHandle.close();

  await persistNomCaches(true);

  // Sanity guards before touching the DB
  const merged = [...existing, ...newEntries];
  if (!DRY_RUN) {
    // (a) minimum expected entries
    if (newEntries.length < 50) {
      throw new Error(
        `refusing to write: only ${newEntries.length} new entries (expected >= 50)`,
      );
    }
    // (b) all new entries must be in Italy bbox
    const outside = newEntries.filter(
      (e) =>
        e.lat < 35.0 || e.lat > 47.5 || e.lng < 6.5 || e.lng > 19.0,
    );
    if (outside.length > 0) {
      throw new Error(
        `refusing to write: ${outside.length} entries outside Italy bbox`,
      );
    }
    // (c) all IDs unique
    const ids = new Set();
    for (const e of newEntries) {
      if (ids.has(e.id))
        throw new Error(`duplicate id in new entries: ${e.id}`);
      ids.add(e.id);
    }
    // (d) no collision with existing IDs
    for (const e of existing) {
      if (ids.has(e.id))
        throw new Error(`new entry id collides with existing: ${e.id}`);
    }
    await saveJson(GEOCODED_PATH, merged);
    try {
      await saveJson(GEOCODED_MIRROR_PATH, merged);
    } catch (err) {
      console.warn(`[mirror] ${err.message}`);
    }
  } else {
    console.log("[dry-run] not writing merged DB");
  }

  // Write review CSV
  const reviewHeaders = [
    "region",
    "comune",
    "beachName",
    "reason",
    "confidence",
    "lat",
    "lng",
    "duplicateOf",
  ];
  const csv = [reviewHeaders.join(",")]
    .concat(
      reviews.map((r) =>
        reviewHeaders
          .map((h) => {
            const v = r[h] ?? "";
            const s = String(v);
            return s.includes(",") || s.includes('"')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(","),
      ),
    )
    .join("\n");
  await fs.writeFile(REVIEW_CSV_PATH, `${csv}\n`, "utf8");

  const byRegion = {};
  for (const e of newEntries) {
    byRegion[e.region] = (byRegion[e.region] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    existingBefore: existing.length,
    totalAfter: merged.length,
    newCount: newEntries.length,
    stats,
    byRegion,
    reviewPath: REVIEW_CSV_PATH,
  };
  await saveJson(REPORT_PATH, report);
  console.log("---- REPORT ----");
  console.log(JSON.stringify(report, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
