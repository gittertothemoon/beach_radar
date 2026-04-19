#!/usr/bin/env node
// Post-ingest validation for BB entries in BeachRadar_Rimini_100_geocoded.json.
// Reports per-region counts, distance sanity checks, ID format, and flags any
// suspicious entries for manual review.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);
const GEOCODED_PATH = path.join(
  ROOT,
  "src/data/BeachRadar_Rimini_100_geocoded.json",
);

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

const main = async () => {
  const data = JSON.parse(await fs.readFile(GEOCODED_PATH, "utf8"));
  const bb = data.filter((b) => b.baselineSource === "BANDIERA_BLU");
  const nonBb = data.filter((b) => b.baselineSource !== "BANDIERA_BLU");
  console.log(`total=${data.length} bb=${bb.length} other=${nonBb.length}`);

  // 1. Region/province breakdown
  const byRegion = {};
  const byProvince = {};
  const byConfidence = {};
  for (const e of bb) {
    byRegion[e.region] = (byRegion[e.region] ?? 0) + 1;
    byProvince[e.province] = (byProvince[e.province] ?? 0) + 1;
    const c = e.geocodeMeta?.confidence ?? "?";
    byConfidence[c] = (byConfidence[c] ?? 0) + 1;
  }
  console.log("BB by region:", byRegion);
  console.log("BB by province:", byProvince);
  console.log("BB by confidence:", byConfidence);

  // 2. Coord sanity
  const outside = bb.filter(
    (e) => e.lat < 35.0 || e.lat > 47.5 || e.lng < 6.5 || e.lng > 19.0,
  );
  console.log("outside Italy bbox:", outside.length);
  for (const o of outside.slice(0, 5)) {
    console.log("  ->", o.id, o.name, o.lat, o.lng);
  }

  // 3. Pairwise proximity inside BB — flag pairs within 50m
  const tooClose = [];
  for (let i = 0; i < bb.length; i++) {
    for (let j = i + 1; j < bb.length; j++) {
      const d = haversineMeters(bb[i], bb[j]);
      if (d < 50) tooClose.push({ a: bb[i].id, b: bb[j].id, d: Math.round(d) });
    }
  }
  console.log("BB pairs within 50m:", tooClose.length);
  for (const p of tooClose.slice(0, 10)) console.log("  ->", p);

  // 4. ID format
  const idRx = /^BR-[A-Z]+-BB-\d{3}$/;
  const badIds = bb.filter((e) => !idRx.test(e.id));
  console.log("bad ID format:", badIds.length);
  for (const b of badIds.slice(0, 5)) console.log("  ->", b.id);

  // 5. Distance from closest existing (non-BB) entry
  let nearExisting = 0;
  for (const e of bb) {
    let minD = Infinity;
    for (const x of nonBb) {
      if (!Number.isFinite(x.lat) || !Number.isFinite(x.lng)) continue;
      const d = haversineMeters(e, x);
      if (d < minD) minD = d;
      if (d < 150) break;
    }
    if (minD < 150) nearExisting++;
  }
  console.log("BB within 150m of non-BB entry:", nearExisting);

  // 6. Confidence distribution per region
  const confByRegion = {};
  for (const e of bb) {
    const c = e.geocodeMeta?.confidence ?? "?";
    confByRegion[e.region] = confByRegion[e.region] ?? {};
    confByRegion[e.region][c] = (confByRegion[e.region][c] ?? 0) + 1;
  }
  console.log("confidence by region:");
  for (const [r, counts] of Object.entries(confByRegion)) {
    console.log(`  ${r}: ${JSON.stringify(counts)}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
