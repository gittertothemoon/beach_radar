import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

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

const children = [];

const spawnChild = (command, args, extraEnv = {}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if ((code ?? 0) !== 0) {
      process.exit(code ?? 1);
    }
  });
  return child;
};

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

killListenPort(3000);
killListenPort(3001);

console.log("[landing:dev] starting landing on http://127.0.0.1:3000/landing/");
spawnChild("node", ["scripts/run-api-dev.mjs"], {
  API_DEV_HOST: "127.0.0.1",
  API_DEV_PORT: "3001",
});
spawnChild("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "3000"], {
  VITE_API_PROXY_TARGET: "http://127.0.0.1:3001",
});
