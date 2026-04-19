#!/usr/bin/env node
/**
 * Enrich beach pins with OSM data via Overpass API.
 * Matches by osm_id (OSM pins) and proximity <200m (all pins).
 * Adds amenities, contact, openingHours fields from OSM tags.
 * Uses .cache/osm_beaches_italy.json to avoid re-downloading.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const DATA_FILE = resolve(ROOT, 'src/data/BeachRadar_Rimini_100_geocoded.json');
const CACHE_DIR = resolve(ROOT, '.cache');
const OSM_CACHE = resolve(CACHE_DIR, 'osm_beaches_italy.json');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="IT"]->.italy;
(
  way["natural"="beach"](area.italy);
  node["natural"="beach"](area.italy);
  relation["natural"="beach"](area.italy);
);
out center tags;`;

const MATCH_RADIUS_M = 200;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function downloadOSMData() {
  console.log('Downloading OSM beach data for Italy (may take 1-2 min)...');
  const body = new URLSearchParams({ data: OVERPASS_QUERY });
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'where2beach-enrichment/1.0 (ivapanto97@gmail.com)',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function extractAmenities(tags) {
  const amenities = {};
  const contact = {};
  let openingHours = null;

  const MAP = {
    surface: 'surface',
    access: 'access',
    fee: 'fee',
    supervised: 'supervised',
    shower: 'showers',
    toilets: 'toilets',
    parking: 'parking',
    wheelchair: 'wheelchair',
    dog: 'dog',
    lifeguard: 'lifeguard',
    nudism: 'nudism',
    sport: 'sport',
    lit: 'lit',
    'changing_rooms': 'changingRooms',
    'beach_resort': 'beachResort',
    'seasonal': 'seasonal',
  };

  for (const [osmKey, localKey] of Object.entries(MAP)) {
    if (tags[osmKey] !== undefined) {
      let val = tags[osmKey];
      // Normalize yes/no to boolean
      if (val === 'yes') val = true;
      else if (val === 'no') val = false;
      amenities[localKey] = val;
    }
  }

  // Contact fields
  for (const key of ['website', 'url', 'contact:website']) {
    if (tags[key]) { contact.website = tags[key]; break; }
  }
  for (const key of ['phone', 'contact:phone', 'contact:mobile']) {
    if (tags[key]) { contact.phone = tags[key]; break; }
  }
  for (const key of ['email', 'contact:email']) {
    if (tags[key]) { contact.email = tags[key]; break; }
  }
  if (tags['operator']) contact.operator = tags['operator'];
  if (tags['brand']) contact.brand = tags['brand'];

  // Opening hours
  if (tags['opening_hours']) openingHours = tags['opening_hours'];
  else if (tags['seasonal'] && tags['seasonal'] !== 'yes' && tags['seasonal'] !== 'no') {
    openingHours = tags['seasonal'];
  }

  // Name variants
  const wikidata = tags['wikidata'] || null;
  const wikipedia = tags['wikipedia'] || null;
  const description = tags['description'] || tags['description:it'] || null;

  return { amenities, contact, openingHours, wikidata, wikipedia, description };
}

function hasUsefulData({ amenities, contact, openingHours, wikidata, wikipedia, description }) {
  return (
    Object.keys(amenities).length > 0 ||
    Object.keys(contact).length > 0 ||
    openingHours ||
    wikidata ||
    wikipedia ||
    description
  );
}

function applyEnrichment(pin, osmTags, osmId, matchType) {
  const { amenities, contact, openingHours, wikidata, wikipedia, description } = extractAmenities(osmTags);

  const changed = hasUsefulData({ amenities, contact, openingHours, wikidata, wikipedia, description });
  if (!changed) return false;

  if (Object.keys(amenities).length > 0) pin.amenities = amenities;
  if (Object.keys(contact).length > 0) pin.contact = contact;
  if (openingHours) pin.openingHours = openingHours;

  if (!pin.osmEnrichMeta) pin.osmEnrichMeta = {};
  pin.osmEnrichMeta.matchedOsmId = osmId;
  pin.osmEnrichMeta.matchType = matchType;

  if (wikidata) pin.osmEnrichMeta.wikidata = wikidata;
  if (wikipedia) pin.osmEnrichMeta.wikipedia = wikipedia;
  if (description) pin.osmEnrichMeta.description = description;

  return true;
}

async function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  // Load or download OSM data
  let osmData;
  if (existsSync(OSM_CACHE)) {
    console.log('Using cached OSM data:', OSM_CACHE);
    osmData = JSON.parse(readFileSync(OSM_CACHE, 'utf8'));
  } else {
    osmData = await downloadOSMData();
    writeFileSync(OSM_CACHE, JSON.stringify(osmData));
    console.log(`Downloaded ${osmData.elements.length} OSM elements, cached.`);
  }

  const elements = osmData.elements;
  console.log(`OSM elements loaded: ${elements.length}`);

  // Build index by OSM id
  const byId = new Map();
  for (const el of elements) {
    byId.set(el.id, el);
  }

  // Build spatial index (simple bounding-box grid for proximity search)
  // Group by ~0.01 degree (~1km) cells
  const CELL = 0.01;
  const grid = new Map();
  for (const el of elements) {
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (lat == null || lng == null) continue;
    const key = `${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push({ id: el.id, lat, lng, tags: el.tags || {} });
  }

  function findNearest(lat, lng) {
    const cy = Math.floor(lat / CELL);
    const cx = Math.floor(lng / CELL);
    let best = null;
    let bestDist = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const key = `${cy + dy},${cx + dx}`;
        const cells = grid.get(key);
        if (!cells) continue;
        for (const el of cells) {
          const d = haversineM(lat, lng, el.lat, el.lng);
          if (d < bestDist) { bestDist = d; best = el; }
        }
      }
    }
    return bestDist <= MATCH_RADIUS_M ? { el: best, dist: bestDist } : null;
  }

  // Load pins
  const pins = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  console.log(`Pins to process: ${pins.length}`);

  // Stats
  let directMatch = 0;
  let proximityMatch = 0;
  let noMatch = 0;
  let enriched = 0;
  const fieldCounts = {};

  for (const pin of pins) {
    const lat = pin.lat;
    const lng = pin.lng;

    let matchedEl = null;
    let matchType = null;

    // 1. Direct OSM id match (for OSM-* pins)
    if (pin.id.startsWith('OSM-')) {
      const osmId = pin.geocodeMeta?.osm_id;
      if (osmId && byId.has(osmId)) {
        matchedEl = byId.get(osmId);
        matchType = 'direct_osm_id';
        directMatch++;
      }
    }

    // 2. Proximity match if no direct match yet
    if (!matchedEl && lat && lng) {
      const nearest = findNearest(lat, lng);
      if (nearest) {
        matchedEl = nearest.el;
        matchType = `proximity_${Math.round(nearest.dist)}m`;
        proximityMatch++;
      }
    }

    if (!matchedEl) { noMatch++; continue; }

    const tags = matchedEl.tags || {};
    const wasEnriched = applyEnrichment(pin, tags, matchedEl.id, matchType);
    if (wasEnriched) {
      enriched++;
      // Track which fields were added
      if (pin.amenities) for (const k of Object.keys(pin.amenities)) fieldCounts[k] = (fieldCounts[k] || 0) + 1;
      if (pin.contact) {
        if (pin.contact.website) fieldCounts['website'] = (fieldCounts['website'] || 0) + 1;
        if (pin.contact.phone) fieldCounts['phone'] = (fieldCounts['phone'] || 0) + 1;
        if (pin.contact.email) fieldCounts['email'] = (fieldCounts['email'] || 0) + 1;
        if (pin.contact.operator) fieldCounts['operator'] = (fieldCounts['operator'] || 0) + 1;
      }
      if (pin.openingHours) fieldCounts['openingHours'] = (fieldCounts['openingHours'] || 0) + 1;
      if (pin.osmEnrichMeta?.wikidata) fieldCounts['wikidata'] = (fieldCounts['wikidata'] || 0) + 1;
      if (pin.osmEnrichMeta?.wikipedia) fieldCounts['wikipedia'] = (fieldCounts['wikipedia'] || 0) + 1;
      if (pin.osmEnrichMeta?.description) fieldCounts['description'] = (fieldCounts['description'] || 0) + 1;
    }
  }

  // Write back
  writeFileSync(DATA_FILE, JSON.stringify(pins, null, 2));

  console.log('\n=== ENRICHMENT REPORT ===');
  console.log(`Total pins:       ${pins.length}`);
  console.log(`Direct OSM match: ${directMatch}`);
  console.log(`Proximity match:  ${proximityMatch}`);
  console.log(`No match:         ${noMatch}`);
  console.log(`Enriched (≥1 new field): ${enriched}`);
  console.log('\nFields added:');
  const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted) console.log(`  ${k.padEnd(20)} ${v}`);
}

main().catch(err => { console.error(err); process.exit(1); });
