import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BADGE_DIR = path.resolve(__dirname, "../src/assets/badges");

const TARGET_SIZE = 256;

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const optimizeOne = async (absPath) => {
  const before = (await stat(absPath)).size;

  const buffer = await sharp(absPath)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
    })
    // Small tuning for readability on 13/28/52 px renders.
    .modulate({
      saturation: 1.06,
      brightness: 1.02,
    })
    .sharpen({
      sigma: 0.9,
      m1: 0.7,
      m2: 2.2,
    })
    .png({
      palette: true,
      quality: 90,
      compressionLevel: 9,
      effort: 10,
    })
    .toBuffer();

  await sharp(buffer).toFile(absPath);
  const after = (await stat(absPath)).size;
  const saved = before - after;
  const ratio = before > 0 ? ((saved / before) * 100).toFixed(1) : "0.0";
  return { before, after, saved, ratio };
};

const main = async () => {
  const entries = await readdir(BADGE_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    console.log("no badge PNG files found");
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const absPath = path.join(BADGE_DIR, file);
    const result = await optimizeOne(absPath);
    totalBefore += result.before;
    totalAfter += result.after;
    console.log(
      `${file}: ${formatBytes(result.before)} -> ${formatBytes(result.after)} (-${result.ratio}%)`,
    );
  }

  const totalSaved = totalBefore - totalAfter;
  const totalRatio = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : "0.0";
  console.log(
    `total: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} (-${totalRatio}%)`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
