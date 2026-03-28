import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const apiRoot = path.join(repoRoot, "api");
const outdir = path.join(repoRoot, ".cache", "api-dev");
const host = process.env.API_DEV_HOST || "127.0.0.1";
const port = Number(process.env.API_DEV_PORT || 3001);

const walk = (dirPath) => {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
};

const entryPoints = walk(apiRoot)
  .filter((filePath) => !filePath.includes(`${path.sep}_handlers${path.sep}`) && !filePath.includes(`${path.sep}_lib${path.sep}`))
  .map((filePath) => path.relative(apiRoot, filePath));

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const chunk of cookieHeader.split(";")) {
    const [rawKey, ...rest] = chunk.split("=");
    const key = rawKey.trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
};

const parseQuery = (url) => {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      const current = out[key];
      out[key] = Array.isArray(current) ? [...current, value] : [current, value];
      continue;
    }
    out[key] = value;
  }
  return out;
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw;
};

const decorateResponse = (res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.hasHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return res;
  };
  res.send = (payload) => {
    if (payload === undefined) {
      res.end();
      return res;
    }
    if (Buffer.isBuffer(payload)) {
      res.end(payload);
      return res;
    }
    if (typeof payload === "object") {
      return res.json(payload);
    }
    res.end(String(payload));
    return res;
  };
  return res;
};

const buildContext = await esbuild.context({
  absWorkingDir: apiRoot,
  entryPoints,
  outdir,
  outbase: ".",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node23",
  sourcemap: false,
  packages: "external",
  logLevel: "silent",
});

await buildContext.watch();
await buildContext.rebuild();

const resolveBundlePath = (pathname) => {
  if (!pathname.startsWith("/api/")) return null;
  const relativePath = pathname.slice("/api/".length).replace(/\/+$/, "");
  const normalized = relativePath.length === 0 ? "index" : relativePath;
  const filePath = path.join(outdir, `${normalized}.js`);
  return fs.existsSync(filePath) ? filePath : null;
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const bundlePath = resolveBundlePath(requestUrl.pathname);
  if (!bundlePath) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const body = await readBody(req);
  req.query = parseQuery(requestUrl);
  req.cookies = parseCookies(typeof req.headers.cookie === "string" ? req.headers.cookie : "");
  req.body = body;

  const decoratedRes = decorateResponse(res);

  try {
    const stat = await fs.promises.stat(bundlePath);
    const moduleUrl = `${pathToFileURL(bundlePath).href}?v=${stat.mtimeMs}`;
    const imported = await import(moduleUrl);
    const handler = imported.default;
    if (typeof handler !== "function") {
      decoratedRes.status(500).json({ ok: false, error: "invalid_handler" });
      return;
    }
    await handler(req, decoratedRes);
  } catch (error) {
    console.error("[api:dev] handler error", error);
    if (!decoratedRes.headersSent) {
      decoratedRes.status(500).json({ ok: false, error: "internal_error" });
    } else {
      decoratedRes.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`[api:dev] ready on http://${host}:${port}`);
});

const shutdown = async () => {
  server.close();
  await buildContext.dispose();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
