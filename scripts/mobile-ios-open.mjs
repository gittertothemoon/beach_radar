import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const mobileEnvPath = path.join(repoRoot, "mobile", ".env");

const DEFAULT_BASE_URL = "https://where2beach.com";
const LOCAL_BASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const METRO_PORT_CANDIDATES = [8081, 8082, 8083, 8084, 8085];

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

const isPrivateOrLocalHost = (host) => {
  if (!host) return false;
  if (LOCAL_BASE_HOSTS.has(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
};

const listLocalIPv4Addresses = () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const values of Object.values(interfaces)) {
    if (!Array.isArray(values)) continue;
    for (const info of values) {
      if (!info || info.family !== "IPv4" || info.internal) continue;
      addresses.push(info.address);
    }
  }
  return addresses;
};

const chooseSimulatorHost = (baseHost) => {
  const localIPv4s = listLocalIPv4Addresses();
  const localSet = new Set(localIPv4s);
  const firstLanHost = localIPv4s.find((candidate) => isPrivateOrLocalHost(candidate));

  if (LOCAL_BASE_HOSTS.has(baseHost)) {
    return firstLanHost ?? "127.0.0.1";
  }

  if (localSet.has(baseHost)) return baseHost;
  if (firstLanHost) return firstLanHost;
  return baseHost;
};

const isPortListening = (host, port, timeoutMs = 500) =>
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

const readSimState = () => {
  const result = spawnSync("xcrun", ["simctl", "list", "devices", "--json"], {
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
};

const pickBootTarget = (devicesByRuntime) => {
  if (!devicesByRuntime || typeof devicesByRuntime !== "object") return null;
  const all = Object.values(devicesByRuntime).flat();
  if (!Array.isArray(all)) return null;
  const available = all.filter((entry) => entry && entry.isAvailable);
  const booted = available.find((entry) => entry.state === "Booted");
  if (booted) return { device: booted, booted: true };

  const preferred =
    available.find((entry) => entry.name === "iPhone 17") ??
    available.find((entry) => typeof entry.name === "string" && entry.name.startsWith("iPhone"));
  if (!preferred) return null;
  return { device: preferred, booted: false };
};

const ensureSimulatorBooted = () => {
  spawnSync("open", ["-a", "Simulator"], { stdio: "ignore" });
  const state = readSimState();
  const target = pickBootTarget(state?.devices);
  if (!target?.device?.udid) return false;
  if (!target.booted) {
    spawnSync("xcrun", ["simctl", "boot", target.device.udid], { stdio: "ignore" });
  }
  spawnSync("xcrun", ["simctl", "bootstatus", target.device.udid, "-b"], { stdio: "ignore" });
  return true;
};

const findMetroPort = async (host) => {
  for (const port of METRO_PORT_CANDIDATES) {
    if (await isPortListening(host, port)) return port;
  }
  return null;
};

const openExpoOnSimulator = (url) => {
  const result = spawnSync("xcrun", ["simctl", "openurl", "booted", url], { encoding: "utf8" });
  return result.status === 0;
};

const main = async () => {
  const baseUrl = readMobileBaseUrl();
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    console.error(`[mobile:ios:open] EXPO_PUBLIC_BASE_URL non valida: ${baseUrl}`);
    process.exit(1);
  }

  const baseHost = normalizeHostForChecks(base.hostname);
  const simulatorHost = chooseSimulatorHost(baseHost);
  const simulatorReady = ensureSimulatorBooted();
  if (!simulatorReady) {
    console.error("[mobile:ios:open] Nessun simulatore iOS disponibile.");
    process.exit(1);
  }

  const metroPort = await findMetroPort(simulatorHost);
  if (!metroPort) {
    console.error(
      `[mobile:ios:open] Metro non raggiungibile su ${simulatorHost}:8081-8085. Avvia prima: npm run mobile:ios`,
    );
    process.exit(1);
  }

  const expoUrl = `exp://${simulatorHost}:${metroPort}`;
  const opened = openExpoOnSimulator(expoUrl);
  if (!opened) {
    console.error(`[mobile:ios:open] Impossibile aprire ${expoUrl} nel simulatore.`);
    process.exit(1);
  }

  console.log(`[mobile:ios:open] Apertura app su simulatore: ${expoUrl}`);
};

await main();
