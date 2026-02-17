import fs from "node:fs/promises";
import path from "node:path";
import {
  buildSyncedSeed,
  loadSeedAndOverrides,
  OUTPUT_PATH,
  saveJson,
} from "./lib/seed-sync-utils.mjs";

const main = async () => {
  const { seed, overrides } = await loadSeedAndOverrides();
  const { merged, missingIds } = buildSyncedSeed(seed, overrides);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await saveJson(OUTPUT_PATH, merged);
  console.log(`Synced seed data to ${OUTPUT_PATH}`);
  if (missingIds.length > 0) {
    console.error(
      `Seed sync failed: missing coords for ${missingIds.length} beaches: ${missingIds.join(", ")}`,
    );
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
