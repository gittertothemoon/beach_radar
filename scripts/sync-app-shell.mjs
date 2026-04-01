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

// Inject modulepreload for lazy App chunk so it downloads in parallel with main entry.
let indexHtml = fs.readFileSync(distIndexHtml, "utf8");
const appChunk = fs.readdirSync(distAssetsDir).find((f) => /^App-[^.]+\.js$/.test(f));
if (appChunk) {
  const preloadTag = `<link rel="modulepreload" crossorigin href="/assets/${appChunk}">`;
  // Insert before the closing </head> tag if not already present.
  if (!indexHtml.includes(preloadTag)) {
    indexHtml = indexHtml.replace("</head>", `  ${preloadTag}\n  </head>`);
  }
  console.log(`[sync:app-shell] injected modulepreload for ${appChunk}`);
} else {
  console.warn("[sync:app-shell] App chunk not found — skipping modulepreload injection");
}

const destIndexHtml = path.join(publicAppShellDir, "index.html");
fs.writeFileSync(destIndexHtml, indexHtml, "utf8");
copyDir(distAssetsDir, publicAssetsDir);

console.log("[sync:app-shell] synced dist/index.html -> public/app-shell/index.html");
console.log("[sync:app-shell] synced dist/assets -> public/assets/");
