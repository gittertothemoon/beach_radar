import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const inputDir =
  process.argv[2] || "/Users/ivanpanto/Downloads/ezgif-8b98271299513ff8-png-split";
const outputDir = path.join(process.cwd(), "public", "decor-sequence");

const TARGET_WIDTH = 768;
const TARGET_HEIGHT = 1344;
const WEBP_QUALITY = 78;

async function main() {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => {
      const aNum = Number.parseInt(a.replace(/\D/g, ""), 10);
      const bNum = Number.parseInt(b.replace(/\D/g, ""), 10);
      return aNum - bNum;
    });

  if (files.length === 0) {
    throw new Error(`No PNG frames found in ${inputDir}`);
  }

  for (let i = 0; i < files.length; i += 1) {
    const source = path.join(inputDir, files[i]);
    const target = path.join(outputDir, `frame_${i}.webp`);

    await sharp(source)
      .resize({
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(target);

    if (i % 20 === 0 || i === files.length - 1) {
      console.log(`Processed ${i + 1}/${files.length}`);
    }
  }

  console.log(`Done. Generated ${files.length} frames in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
