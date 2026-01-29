import type { VercelRequest, VercelResponse } from "@vercel/node";

const ACCESS_COOKIE = "br_app_access";
const ACCESS_COOKIE_VALUE = "1";
const APP_PATH_PREFIX = "/app";

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getKeyParam(req: VercelRequest): string | null {
  const raw = req.query.key;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

function getPathParam(req: VercelRequest): string | null {
  const raw = req.query.path;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

function sanitizeAppPath(path: string | null): string {
  if (!path) return `${APP_PATH_PREFIX}/`;
  const trimmed = path.trim();
  if (!trimmed) return `${APP_PATH_PREFIX}/`;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (normalized === APP_PATH_PREFIX || normalized.startsWith(`${APP_PATH_PREFIX}/`)) {
    return normalized;
  }
  return `${APP_PATH_PREFIX}/`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const accessKey = readEnv("APP_ACCESS_KEY") ?? "";
  if (!accessKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const providedKey = getKeyParam(req);
  if (!providedKey || providedKey !== accessKey) {
    res.writeHead(302, { Location: "/waitlist/" });
    return res.end();
  }

  const nextPath = sanitizeAppPath(getPathParam(req));
  res.setHeader(
    "Set-Cookie",
    `${ACCESS_COOKIE}=${ACCESS_COOKIE_VALUE}; Max-Age=2592000; Path=/app; HttpOnly; SameSite=Lax; Secure`
  );
  res.writeHead(302, { Location: nextPath });
  return res.end();
}
