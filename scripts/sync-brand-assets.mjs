import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".");
const CHECK_ONLY = process.argv.includes("--check");

const ASSET_MAP = [
  {
    source: "src/assets/logo.png",
    targets: ["public/waitlist/logo.png", "remotion/public/video-kit/logo.png"],
  },
  {
    source: "src/assets/initial-bg.png",
    targets: ["remotion/public/video-kit/initial-bg.png"],
  },
  {
    source: "src/assets/sharecard-bg.png",
    targets: ["remotion/public/video-kit/sharecard-bg.png"],
  },
  {
    source: "src/assets/markers/pin_beach.png",
    targets: ["remotion/public/video-kit/pin_beach.png"],
  },
  {
    source: "src/assets/markers/pin_beach_poco_affollata.png",
    targets: ["remotion/public/video-kit/pin_beach_poco_affollata.png"],
  },
  {
    source: "src/assets/markers/pin_beach_affollata.png",
    targets: ["remotion/public/video-kit/pin_beach_affollata.png"],
  },
  {
    source: "src/assets/markers/pin_beach_piena.png",
    targets: ["remotion/public/video-kit/pin_beach_piena.png"],
  },
  {
    source: "src/assets/markers/pin_cluster.png",
    targets: ["remotion/public/video-kit/pin_cluster.png"],
  },
  {
    source: "public/og/og-default.png",
    targets: ["remotion/public/video-kit/og-default.png"],
  },
];

const readFileOrNull = async (filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
};

const main = async () => {
  const changed = [];
  const inSync = [];
  const missingSources = [];

  for (const entry of ASSET_MAP) {
    const sourcePath = path.resolve(ROOT, entry.source);
    const sourceBuffer = await readFileOrNull(sourcePath);
    if (!sourceBuffer) {
      missingSources.push(entry.source);
      continue;
    }

    for (const target of entry.targets) {
      const targetPath = path.resolve(ROOT, target);
      const targetBuffer = await readFileOrNull(targetPath);
      const matches =
        targetBuffer !== null &&
        targetBuffer.length === sourceBuffer.length &&
        sourceBuffer.equals(targetBuffer);

      if (matches) {
        inSync.push(`${entry.source} -> ${target}`);
        continue;
      }

      if (CHECK_ONLY) {
        changed.push(`${entry.source} -> ${target}`);
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, sourceBuffer);
      changed.push(`${entry.source} -> ${target}`);
    }
  }

  if (missingSources.length > 0) {
    console.error("Missing source assets:");
    missingSources.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
    return;
  }

  if (CHECK_ONLY) {
    if (changed.length > 0) {
      console.error("Asset drift detected. Run: npm run assets:sync");
      changed.forEach((item) => console.error(`- ${item}`));
      process.exitCode = 1;
      return;
    }
    console.log(`Brand assets are in sync (${inSync.length} links checked).`);
    return;
  }

  console.log(
    changed.length > 0
      ? `Synced ${changed.length} asset links.`
      : `No asset changes needed (${inSync.length} links already in sync).`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
