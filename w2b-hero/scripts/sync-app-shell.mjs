import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const heroRoot = resolve(scriptDir, "..");
const repoRoot = resolve(heroRoot, "..");

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    const joined = [cmd, ...args].join(" ");
    throw new Error(`Command failed (${result.status ?? "?"}): ${joined}`);
  }
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function syncDir(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required directory: ${sourcePath}`);
  }
  rmSync(destinationPath, { recursive: true, force: true });
  ensureParent(destinationPath);
  cpSync(sourcePath, destinationPath, { recursive: true });
}

function syncFile(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required file: ${sourcePath}`);
  }
  ensureParent(destinationPath);
  cpSync(sourcePath, destinationPath);
}

function syncOptionalFile(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) return;
  ensureParent(destinationPath);
  cpSync(sourcePath, destinationPath);
}

function syncOptionalDir(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) {
    rmSync(destinationPath, { recursive: true, force: true });
    return;
  }
  syncDir(sourcePath, destinationPath);
}

const rootNodeModules = resolve(repoRoot, "node_modules");
if (!existsSync(rootNodeModules)) {
  run("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"], repoRoot);
}

run("npm", ["run", "build"], repoRoot);

const distRoot = resolve(repoRoot, "dist");
const rootPublic = resolve(repoRoot, "public");
const heroPublic = resolve(heroRoot, "public");

syncFile(resolve(distRoot, "index.html"), resolve(heroPublic, "app-shell", "index.html"));
syncDir(resolve(distRoot, "assets"), resolve(heroPublic, "assets"));

syncOptionalFile(
  resolve(rootPublic, "manifest.webmanifest"),
  resolve(heroPublic, "manifest.webmanifest"),
);
syncOptionalFile(
  resolve(rootPublic, "favicon-16x16.png"),
  resolve(heroPublic, "favicon-16x16.png"),
);
syncOptionalFile(
  resolve(rootPublic, "favicon-32x32.png"),
  resolve(heroPublic, "favicon-32x32.png"),
);
syncOptionalFile(
  resolve(rootPublic, "apple-touch-icon.png"),
  resolve(heroPublic, "apple-touch-icon.png"),
);

syncOptionalDir(resolve(rootPublic, "icons"), resolve(heroPublic, "icons"));
syncOptionalDir(resolve(rootPublic, "og"), resolve(heroPublic, "og"));

syncDir(resolve(repoRoot, "api"), resolve(heroRoot, "api"));
