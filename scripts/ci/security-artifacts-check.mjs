import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, "dist"),
  path.join(ROOT, "w2b-hero", "public", "assets"),
];

function walkFiles(dirPath, output) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, output);
      continue;
    }
    output.push(fullPath);
  }
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath) || filePath;
}

function main() {
  const issues = [];

  for (const dirPath of TARGET_DIRS) {
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    const files = [];
    walkFiles(dirPath, files);
    for (const filePath of files) {
      if (filePath.endsWith(".map")) {
        issues.push(`Unexpected sourcemap artifact: ${toRelative(filePath)}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error("Security artifacts check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Security artifacts check passed.");
}

main();
