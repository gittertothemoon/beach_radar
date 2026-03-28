import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const distDir = path.join(repoRoot, "dist");
const distIndexHtml = path.join(distDir, "index.html");
const distAssetsDir = path.join(distDir, "assets");
const publicDir = path.join(repoRoot, "public");
const publicAppShellDir = path.join(publicDir, "app-shell");
const publicAssetsDir = path.join(publicDir, "assets");
const publicAssetsKeep = new Set(["og"]);

const ensureExists = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    console.error(`[sync:app-shell] missing ${label}: ${path.relative(repoRoot, targetPath)}`);
    process.exit(1);
  }
};

const emptyDir = (targetPath, { keep = new Set() } = {}) => {
  fs.mkdirSync(targetPath, { recursive: true });
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (keep.has(entry.name)) continue;
    fs.rmSync(path.join(targetPath, entry.name), { recursive: true, force: true });
  }
};

const copyDir = (sourceDir, destinationDir) => {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
      continue;
    }
    fs.copyFileSync(sourcePath, destinationPath);
  }
};

ensureExists(distIndexHtml, "dist index.html");
ensureExists(distAssetsDir, "dist assets");

emptyDir(publicAppShellDir);
emptyDir(publicAssetsDir, { keep: publicAssetsKeep });

fs.copyFileSync(distIndexHtml, path.join(publicAppShellDir, "index.html"));
copyDir(distAssetsDir, publicAssetsDir);

console.log("[sync:app-shell] synced dist/index.html -> public/app-shell/index.html");
console.log("[sync:app-shell] synced dist/assets -> public/assets/");
