import net from "node:net";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const mobileEnvPath = path.join(repoRoot, "mobile", ".env");

const DEFAULT_BASE_URL = "https://where2beach.com";
const LOCAL_BASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const WAIT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 350;
const IOS_BUNDLE_ID = "com.where2beach.mobile";
const METRO_PORT_CANDIDATES = [8081, 8082, 8083, 8084, 8085];

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

const chooseSimulatorHost = (baseHost) => {
  const localIPv4s = listLocalIPv4Addresses();
  const localSet = new Set(localIPv4s);
  const firstLanHost = localIPv4s.find((candidate) => isPrivateOrLocalHost(candidate));

  if (LOCAL_BASE_HOSTS.has(baseHost)) {
    // iOS simulator moderno (macOS 12+) raggiunge localhost direttamente.
    // Usare l'IP LAN introduce latenza e rende instabile l'HMR WebSocket.
    return { host: "127.0.0.1", reason: null };
  }

  if (localSet.has(baseHost)) {
    return { host: baseHost, reason: null };
  }

  if (firstLanHost) {
    return {
      host: firstLanHost,
      reason: `host ${baseHost} non trovato sulle interfacce locali, uso ${firstLanHost}`,
    };
  }

  return {
    host: baseHost,
    reason: null,
  };
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

const isMetroRunning = (host, port, timeoutMs = 900) =>
  new Promise((resolve) => {
    const request = http.get(
      {
        host,
        port,
        path: "/status",
        timeout: timeoutMs,
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          resolve(raw.includes("packager-status:running"));
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });

const resolveMetroPort = async (host) => {
  const envPort = Number(process.env.EXPO_DEV_SERVER_PORT);
  if (Number.isInteger(envPort) && envPort > 0) {
    return { port: envPort, reason: "porto Metro da EXPO_DEV_SERVER_PORT" };
  }

  for (const candidate of METRO_PORT_CANDIDATES) {
    if (await isMetroRunning(host, candidate)) {
      return { port: candidate, reason: `riuso Metro gia attivo su ${host}:${candidate}` };
    }
  }

  for (const candidate of METRO_PORT_CANDIDATES) {
    const busyOnHost = await isPortListening(host, candidate);
    const busyOnLoopback = host === "127.0.0.1" ? busyOnHost : await isPortListening("127.0.0.1", candidate);
    if (!busyOnHost && !busyOnLoopback) {
      return { port: candidate, reason: `seleziono porta Metro libera ${candidate}` };
    }
  }

  return { port: METRO_PORT_CANDIDATES[0], reason: "nessuna porta libera trovata, fallback su 8081" };
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

const setSimulatorJsLocation = (host, port) => {
  const jsLocation = `${host}:${port}`;
  const result = spawnSync(
    "xcrun",
    [
      "simctl",
      "spawn",
      "booted",
      "defaults",
      "write",
      IOS_BUNDLE_ID,
      "RCT_jsLocation",
      "-string",
      jsLocation,
    ],
    { encoding: "utf8" },
  );
  if (result.status === 0) {
    console.log(`[mobile:ios] iOS dev bundle impostato su ${jsLocation}`);
  } else {
    const stderr = (result.stderr || "").trim();
    const detail = stderr ? ` (${stderr})` : "";
    console.warn(`[mobile:ios] impossibile impostare RCT_jsLocation=${jsLocation}${detail}`);
  }
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
  const baseIsHttp = base.protocol === "http:" || base.protocol === "https:";
  const baseIsLocal = baseIsHttp && isPrivateOrLocalHost(baseHost);
  const webPort = Number(base.port || 5173);

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
    const { host: simulatorHost, reason: simulatorHostReason } =
      chooseSimulatorHost(baseHost);
    const simulatorBaseOrigin = `http://${simulatorHost}:${webPort}`;
    const webHost = simulatorHost;
    const viteBindHost = simulatorHost === "127.0.0.1" ? "127.0.0.1" : "0.0.0.0";
    const { port: metroPort, reason: metroPortReason } = await resolveMetroPort(simulatorHost);

    if (simulatorHostReason) {
      console.log(`[mobile:ios] ${simulatorHostReason}`);
    }
    if (metroPortReason) {
      console.log(`[mobile:ios] ${metroPortReason}`);
    }

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
        args: ["run", "dev", "--", "--host", viteBindHost, "--port", String(webPort)],
        cwd: repoRoot,
      });
      await waitForPort(webHost, webPort, WAIT_TIMEOUT_MS, "Frontend locale");
      console.log(`[mobile:ios] Frontend locale pronto su ${simulatorBaseOrigin}`);
    } else {
      console.log(`[mobile:ios] Frontend locale gia attivo su ${simulatorBaseOrigin}`);
    }

    setSimulatorJsLocation(simulatorHost, metroPort);
    console.log("[mobile:ios] avvio Expo iOS...");
    const expo = spawn(
      "npm",
      ["--prefix", "mobile", "run", "ios:expo", "--", "--port", String(metroPort)],
      {
      cwd: repoRoot,
      env: {
        ...process.env,
        EXPO_PUBLIC_BASE_URL: simulatorBaseOrigin,
        REACT_NATIVE_PACKAGER_HOSTNAME: simulatorHost,
        EXPO_DEV_SERVER_PORT: String(metroPort),
        RCT_METRO_PORT: String(metroPort),
      },
      stdio: "inherit",
    });
    setTimeout(() => {
      setSimulatorJsLocation(simulatorHost, metroPort);
    }, 5500);

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
    return;
  } else {
    console.log(
      `[mobile:ios] EXPO_PUBLIC_BASE_URL punta a remoto (${base.origin}), salto avvio stack locale`,
    );
  }

  console.log("[mobile:ios] avvio Expo iOS...");
  const { port: metroPort, reason: metroPortReason } = await resolveMetroPort("127.0.0.1");
  if (metroPortReason) {
    console.log(`[mobile:ios] ${metroPortReason}`);
  }
  setSimulatorJsLocation("127.0.0.1", metroPort);
  const expo = spawn("npm", ["--prefix", "mobile", "run", "ios:expo", "--", "--port", String(metroPort)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      EXPO_DEV_SERVER_PORT: String(metroPort),
      RCT_METRO_PORT: String(metroPort),
    },
    stdio: "inherit",
  });
  setTimeout(() => {
    setSimulatorJsLocation("127.0.0.1", metroPort);
  }, 5500);

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
