import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

const BASE_URL = "https://beach-radar.vercel.app";

const QR_PLATE = { x: 302, y: 850, w: 420, h: 420, r: 30 };
const QR_PADDING = 20;

const ROOT = process.cwd();
const MASTER_PATH = path.resolve(ROOT, "tools/posters/templates/master.png");
const CSV_PATH = path.resolve(ROOT, "tools/posters/input/lidi.csv");
const OUT_DIR = path.resolve(ROOT, "tools/posters/out");
const ONLY_SRC = process.env.POSTER_ONLY_SRC?.trim();
const DEBUG_PLATE = process.env.POSTER_DEBUG_PLATE === "1";
const DEBUG_URL = process.env.POSTER_DEBUG_URL === "1";

const parseCsv = (content) => {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };

  const parseLine = (line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current);
    return cells;
  };

  const header = parseLine(lines[0]).map((value) => value.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = {};
    header.forEach((key, index) => {
      row[key] = values[index] ?? "";
    });
    return row;
  });
  return { header, rows };
};

const buildPlateSvg = () =>
  Buffer.from(
    `<svg width="${QR_PLATE.w}" height="${QR_PLATE.h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${QR_PLATE.w}" height="${QR_PLATE.h}" rx="${QR_PLATE.r}" ry="${QR_PLATE.r}" fill="#ffffff"/></svg>`,
  );

const main = async () => {
  try {
    await fs.access(MASTER_PATH);
  } catch {
    console.error(
      `Missing master poster at ${MASTER_PATH}. Add the file before running.`,
    );
    process.exit(1);
  }

  try {
    await fs.access(CSV_PATH);
  } catch {
    console.error(
      `Missing CSV at ${CSV_PATH}. Run "npm run posters:csv" first.`,
    );
    process.exit(1);
  }

  const csvContent = await fs.readFile(CSV_PATH, "utf8");
  const { header, rows } = parseCsv(csvContent);
  const expectedHeader = ["city", "lido_name", "src", "beachId"];
  if (
    expectedHeader.some((key, index) => header[index] !== key) ||
    header.length < expectedHeader.length
  ) {
    console.error(
      `Unexpected CSV header. Expected: ${expectedHeader.join(",")}`,
    );
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  if (ONLY_SRC) {
    const targetPath = path.resolve(OUT_DIR, `${ONLY_SRC}.png`);
    try {
      await fs.unlink(targetPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    console.log(`Single mode: overwriting ${ONLY_SRC}.png`);
  } else {
    const entries = await fs.readdir(OUT_DIR, { withFileTypes: true });
    const pngFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map((entry) => entry.name);
    await Promise.all(
      pngFiles.map((file) => fs.unlink(path.resolve(OUT_DIR, file))),
    );
    console.log(`Batch mode: cleared ${pngFiles.length} old posters`);
  }
  const masterBuffer = await fs.readFile(MASTER_PATH);
  const masterMeta = await sharp(masterBuffer).metadata();
  const masterWidth = masterMeta.width ?? 0;
  const masterHeight = masterMeta.height ?? 0;
  const boundsOk =
    QR_PLATE.x >= 0 &&
    QR_PLATE.y >= 0 &&
    QR_PLATE.x + QR_PLATE.w <= masterWidth &&
    QR_PLATE.y + QR_PLATE.h <= masterHeight;

  if (!boundsOk) {
    throw new Error(
      `QR_PLATE overflows master (${masterWidth}x${masterHeight}). ` +
        `Plate bounds: x=${QR_PLATE.x}, y=${QR_PLATE.y}, ` +
        `w=${QR_PLATE.w}, h=${QR_PLATE.h}`,
    );
  }
  const plateSvg = buildPlateSvg();
  const qrSize = QR_PLATE.w - QR_PADDING * 2;

  if (qrSize <= 0) {
    console.error("QR padding is too large for the plate size.");
    process.exit(1);
  }

  if (DEBUG_PLATE) {
    const debugSvg = Buffer.from(
      `<svg width="${masterWidth}" height="${masterHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="${QR_PLATE.x}" y="${QR_PLATE.y}" width="${QR_PLATE.w}" height="${QR_PLATE.h}" rx="${QR_PLATE.r}" ry="${QR_PLATE.r}" fill="rgba(244,63,94,0.25)" stroke="rgba(244,63,94,0.9)" stroke-width="4"/></svg>`,
    );
    const debugPath = path.resolve(OUT_DIR, "_debug_plate.png");
    await sharp(masterBuffer)
      .composite([{ input: debugSvg, left: 0, top: 0 }])
      .png()
      .toFile(debugPath);
  }

  const rowsToProcess = ONLY_SRC
    ? rows.filter((row) => String(row.src ?? "").trim() === ONLY_SRC)
    : rows;

  if (ONLY_SRC && rowsToProcess.length === 0) {
    console.error(`No CSV row found for src="${ONLY_SRC}".`);
    process.exit(1);
  }

  let ok = 0;
  const failed = [];

  for (const row of rowsToProcess) {
    const src = String(row.src ?? "").trim();
    const beachId = String(row.beachId ?? "").trim();
    if (!src || !beachId) {
      failed.push({ src, beachId, reason: "Missing src or beachId" });
      continue;
    }

    const url = new URL(BASE_URL);
    const params = new URLSearchParams({
      beach: beachId,
      src,
      utm_source: "qr",
      utm_medium: "poster",
      utm_campaign: "pilot2026",
    });
    url.search = params.toString();
    if (DEBUG_URL) {
      console.log(`QR URL (${src}): ${url.toString()}`);
    }

    try {
      const qrBuffer = await QRCode.toBuffer(url.toString(), {
        errorCorrectionLevel: "Q",
        margin: 1,
        width: qrSize,
      });

      const outputPath = path.resolve(OUT_DIR, `${src}.png`);
      await sharp(masterBuffer)
        .composite([
          {
            input: plateSvg,
            left: QR_PLATE.x,
            top: QR_PLATE.y,
          },
          {
            input: qrBuffer,
            left: QR_PLATE.x + QR_PADDING,
            top: QR_PLATE.y + QR_PADDING,
          },
        ])
        .png()
        .toFile(outputPath);

      ok += 1;
    } catch (error) {
      failed.push({ src, beachId, reason: error?.message ?? "Unknown error" });
    }
  }

  const total = rowsToProcess.length;
  console.log(
    ONLY_SRC
      ? `Single mode: generated 1 poster (${ONLY_SRC}.png)`
      : `Posters generated: ${ok}/${total}`,
  );
  if (failed.length > 0) {
    console.log("Failed rows:");
    failed.forEach((item) => {
      console.log(
        `- src=${item.src || "?"} beachId=${item.beachId || "?"} (${
          item.reason
        })`,
      );
    });
  }
};

main().catch((error) => {
  console.error("Poster generation failed:", error);
  process.exit(1);
});
