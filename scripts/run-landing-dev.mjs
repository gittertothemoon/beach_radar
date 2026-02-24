import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const heroDir = path.join(repoRoot, "w2b-hero");

const removeIfExists = (target) => {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[landing:dev] removed ${path.relative(repoRoot, target)}`);
};

const killListenPort = (port) => {
  let stdout = "";
  try {
    stdout = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
  } catch {
    return;
  }

  const pids = stdout
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (pids.length === 0) return;
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // Ignore races when process exits before kill.
    }
  }
  console.log(`[landing:dev] killed ${pids.length} process(es) on :${port}`);
};

const ensureHeroProject = () => {
  const heroPackageJson = path.join(heroDir, "package.json");
  if (!fs.existsSync(heroPackageJson)) {
    console.error(`[landing:dev] missing ${heroPackageJson}`);
    process.exit(1);
  }
};

const startNextDev = () => {
  const args = [
    "-y",
    "node@20",
    "./node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    "3000",
  ];

  console.log("[landing:dev] starting Next dev on http://127.0.0.1:3000");
  const child = spawn("npx", args, {
    cwd: heroDir,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
};

ensureHeroProject();
removeIfExists(path.join(repoRoot, ".next"));
removeIfExists(path.join(repoRoot, "next-env.d.ts"));
removeIfExists(path.join(heroDir, ".next"));
killListenPort(3000);
startNextDev();
