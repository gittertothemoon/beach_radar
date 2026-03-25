import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const mobileEnvPath = path.join(repoRoot, "mobile", ".env");

const DEFAULT_BASE_URL = "https://where2beach.com";
const LOCAL_BASE_HOSTS = new Set(["127.0.0.1", "localhost"]);
const WAIT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 350;

const startedChildren = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseDotEnv = (content) => {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
};

const readMobileBaseUrl = () => {
  if (!fs.existsSync(mobileEnvPath)) return DEFAULT_BASE_URL;
  const raw = fs.readFileSync(mobileEnvPath, "utf8");
  const env = parseDotEnv(raw);
  return env.EXPO_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
};

const normalizeHostForChecks = (value) => {
  const lower = value.toLowerCase();
  return lower === "localhost" ? "127.0.0.1" : lower;
};

const isPortListening = (host, port, timeoutMs = 900) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let done = false;

    const finish = (isOpen) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

const waitForPort = async (host, port, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortListening(host, port)) return;
    await sleep(RETRY_DELAY_MS);
  }
  throw new Error(`${label} non raggiungibile su ${host}:${port} entro ${timeoutMs}ms`);
};

const spawnService = ({ label, cmd, args, cwd }) => {
  console.log(`[mobile:ios] avvio ${label}...`);
  const child = spawn(cmd, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(`[mobile:ios] errore avvio ${label}: ${error.message}`);
  });
  startedChildren.push({ label, child });
  return child;
};

let cleaningUp = false;
const cleanupChildren = (signal = "SIGTERM") => {
  if (cleaningUp) return;
  cleaningUp = true;
  for (const { child } of startedChildren) {
    if (!child.killed && child.exitCode == null) {
      try {
        process.kill(child.pid, signal);
      } catch {
        // Ignore already-exited children.
      }
    }
  }
};

const main = async () => {
  const baseUrl = readMobileBaseUrl();
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    console.error(`[mobile:ios] EXPO_PUBLIC_BASE_URL non valida: ${baseUrl}`);
    process.exit(1);
  }

  const baseHost = normalizeHostForChecks(base.hostname);
  const baseIsLocal =
    (base.protocol === "http:" || base.protocol === "https:") &&
    LOCAL_BASE_HOSTS.has(baseHost);

  process.on("SIGINT", () => {
    cleanupChildren("SIGTERM");
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanupChildren("SIGTERM");
    process.exit(143);
  });
  process.on("exit", () => cleanupChildren("SIGTERM"));

  if (baseIsLocal) {
    const apiHost = "127.0.0.1";
    const apiPort = 3000;
    const webHost = "127.0.0.1";
    const webPort = Number(base.port || 5173);

    const apiUp = await isPortListening(apiHost, apiPort);
    if (!apiUp) {
      spawnService({
        label: "Vercel dev API (:3000)",
        cmd: "vercel",
        args: ["dev", "--listen", "3000", "--yes"],
        cwd: repoRoot,
      });
      await waitForPort(apiHost, apiPort, WAIT_TIMEOUT_MS, "API locale");
      console.log("[mobile:ios] API locale pronta su http://127.0.0.1:3000");
    } else {
      console.log("[mobile:ios] API locale gia attiva su http://127.0.0.1:3000");
    }

    const webUp = await isPortListening(webHost, webPort);
    if (!webUp) {
      spawnService({
        label: `Vite dev (:${webPort})`,
        cmd: "npm",
        args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(webPort)],
        cwd: repoRoot,
      });
      await waitForPort(webHost, webPort, WAIT_TIMEOUT_MS, "Frontend locale");
      console.log(`[mobile:ios] Frontend locale pronto su ${base.origin}`);
    } else {
      console.log(`[mobile:ios] Frontend locale gia attivo su ${base.origin}`);
    }
  } else {
    console.log(
      `[mobile:ios] EXPO_PUBLIC_BASE_URL punta a remoto (${base.origin}), salto avvio stack locale`,
    );
  }

  console.log("[mobile:ios] avvio Expo iOS...");
  const expo = spawn("npm", ["--prefix", "mobile", "run", "ios"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  expo.once("error", (error) => {
    console.error(`[mobile:ios] errore avvio Expo: ${error.message}`);
    cleanupChildren("SIGTERM");
    process.exit(1);
  });

  expo.once("exit", (code, signal) => {
    cleanupChildren("SIGTERM");
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
};

main().catch((error) => {
  console.error(`[mobile:ios] ${error.message}`);
  cleanupChildren("SIGTERM");
  process.exit(1);
});
