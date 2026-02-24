import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(".");

const readTrackedFiles = () => {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "buffer",
  });
  return output
    .toString("utf8")
    .split("\u0000")
    .filter(Boolean);
};

const main = () => {
  const errors = [];
  const files = readTrackedFiles();

  const rootFiles = files.filter((file) => !file.includes("/"));
  const forbiddenRootData = rootFiles.filter(
    (file) =>
      /^BeachRadar_.*_schema\.(json|csv)$/.test(file) ||
      /^seed-overrides_.*_schema\.json$/.test(file) ||
      /^Onda - [1-5]\.PNG$/.test(file),
  );
  if (forbiddenRootData.length > 0) {
    errors.push(
      `Root contains raw dataset files: ${forbiddenRootData.join(", ")}. Move them to data/raw/.`,
    );
  }

  const trackedPosterOutput = files.filter((file) =>
    file.startsWith("tools/posters/out/"),
  );
  if (trackedPosterOutput.length > 0) {
    errors.push(
      `Generated posters are tracked: ${trackedPosterOutput.length} files under tools/posters/out/.`,
    );
  }

  const rawOverrides = files.filter((file) =>
    file.startsWith("data/raw/seed-overrides_") &&
    file.endsWith("_schema.json"),
  );
  const invalidOverrideNames = rawOverrides.filter(
    (file) => !/^data\/raw\/seed-overrides_[A-Z0-9_]+_schema\.json$/.test(file),
  );
  if (invalidOverrideNames.length > 0) {
    errors.push(
      `Invalid raw override naming (use uppercase tokens): ${invalidOverrideNames.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    console.error("Repo hygiene check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Repo hygiene check passed.");
};

main();
