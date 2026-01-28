import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

if (process.env.CI === "true" && !process.env.BASE_URL) {
  throw new Error("BASE_URL is required in CI for waitlist smoke tests.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.HOST || "127.0.0.1";
const serveScript = path.resolve(__dirname, "serve-static.mjs");
const verifyCleanup = process.env.SMOKE_VERIFY_CLEANUP === "1";
const timeoutMs = Number(process.env.SMOKE_READY_TIMEOUT_MS || 12_000);

function startServer() {
  const detached = process.platform !== "win32";
  const child = spawn(process.execPath, [serveScript], {
    env: { ...process.env, PORT: "0", HOST: host },
    stdio: ["ignore", "pipe", "pipe"],
    detached
  });

  if (child.pid) {
    console.log(`STATIC_PID=${child.pid}`);
  }

  return { child, ready: waitForReady(child) };
}

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk) => {
      buffer += chunk.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("SMOKE_READY ")) {
          const url = line.slice("SMOKE_READY ".length).trim();
          cleanup();
          resolve(url);
          return;
        }
      }
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onExit = (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`Static server exited with code ${code}`));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onStderr);
      child.off("error", onError);
      child.off("exit", onExit);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for SMOKE_READY from static server."));
    }, timeoutMs);

    const onStderr = (chunk) => {
      const msg = chunk.toString().trim();
      if (msg.length > 0) {
        console.error(`[static] ${msg}`);
      }
      onData(chunk);
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onStderr);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

function runPlaywright(baseUrl) {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["playwright", "test", "tests/waitlist.smoke.spec.ts"];
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, BASE_URL: baseUrl }
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function killProcessGroup(child, signal) {
  if (!child?.pid) return false;
  if (process.platform === "win32") return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (_) {
    return false;
  }
}

async function stopServer(child) {
  if (!child || child.killed) return;
  const signaledGroup = killProcessGroup(child, "SIGTERM");
  if (!signaledGroup) child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const killedGroup = killProcessGroup(child, "SIGKILL");
      if (!killedGroup && !child.killed) child.kill("SIGKILL");
      resolve();
    }, 1500);

    child.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function probeCleanup(url) {
  if (!url) return true;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return true;
  }

  const hostName = parsed.hostname;
  const port = Number(parsed.port);
  if (!hostName || !port) return true;

  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ host: hostName, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });

    if (!ok) return true;
    await new Promise((r) => setTimeout(r, 150));
  }

  return false;
}

const { child, ready } = startServer();
let exitCode = 1;
let baseUrl = "";

try {
  baseUrl = await ready;
  if (baseUrl) {
    console.log(`STATIC_URL=${baseUrl}`);
  }
  exitCode = await runPlaywright(baseUrl);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  await stopServer(child);
  if (baseUrl) {
    const cleaned = await probeCleanup(baseUrl);
    if (!cleaned) {
      console.error("Static server cleanup failed: port still accepting connections");
      if (verifyCleanup) exitCode = 1;
    }
  }
}

process.exit(exitCode);
