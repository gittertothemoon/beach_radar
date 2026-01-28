import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.HOST || "127.0.0.1";
const serveScript = path.resolve(__dirname, "serve-static.mjs");

function startServer() {
  const child = spawn(process.execPath, [serveScript], {
    env: { ...process.env, PORT: "0", HOST: host },
    stdio: ["ignore", "pipe", "pipe"]
  });

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
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
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

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      resolve();
    }, 2000);

    child.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

const { child, ready } = startServer();
let exitCode = 1;

try {
  const baseUrl = await ready;
  exitCode = await runPlaywright(baseUrl);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  await stopServer(child);
}

process.exit(exitCode);
