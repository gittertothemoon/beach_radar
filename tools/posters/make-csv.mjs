import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_JSON = path.resolve(
  ROOT,
  "src/data/BeachRadar_Riviera_30_geocoded.json",
);
const OUTPUT_CSV = path.resolve(ROOT, "tools/posters/input/lidi.csv");

const csvEscape = (value) => {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const main = async () => {
  try {
    await fs.access(SOURCE_JSON);
  } catch {
    console.error(
      `Missing source JSON at ${SOURCE_JSON}. Cannot generate CSV.`,
    );
    process.exit(1);
  }

  const raw = await fs.readFile(SOURCE_JSON, "utf8");
  let spots;
  try {
    spots = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON in source dataset.");
    process.exit(1);
  }

  if (!Array.isArray(spots)) {
    console.error("Source dataset is not an array.");
    process.exit(1);
  }

  const slugCounts = new Map();
  const rows = [];

  spots.forEach((spot) => {
    const name = typeof spot?.name === "string" ? spot.name.trim() : "";
    const beachId = typeof spot?.id === "string" ? spot.id.trim() : "";
    if (!name || !beachId) return;

    const city = typeof spot?.city === "string" ? spot.city.trim() : "";
    const base = slugify(`${name}-${city}`) || slugify(name) || beachId;
    const count = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, count);
    const src = count === 1 ? base : `${base}-${count}`;

    rows.push({
      city,
      lido_name: name,
      src,
      beachId,
    });
  });

  await fs.mkdir(path.dirname(OUTPUT_CSV), { recursive: true });
  const header = ["city", "lido_name", "src", "beachId"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      header.map((key) => csvEscape(row[key] ?? "")).join(","),
    ),
  ];
  await fs.writeFile(OUTPUT_CSV, `${lines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${rows.length} rows to ${OUTPUT_CSV}`);
};

main().catch((error) => {
  console.error("CSV generation failed:", error);
  process.exit(1);
});
