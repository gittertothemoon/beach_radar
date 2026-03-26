import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, timingSafeEqual } from "node:crypto";
import { applyApiSecurityHeaders, readEnv } from "./_lib/security.js";

const ACCESS_COOKIE = "br_app_access";
const ACCESS_COOKIE_VALUE = "1";
const APP_PATH_PREFIX = "/app";
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

type AccessKeyConfig =
  | { mode: "raw"; value: string }
  | { mode: "sha256"; value: string };

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

function timingSafeEqualText(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function normalizeSha256Hex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.startsWith("sha256:") ? trimmed.slice("sha256:".length) : trimmed;
  return SHA256_HEX_RE.test(normalized) ? normalized : null;
}

function resolveAccessKeyConfig(): { config: AccessKeyConfig | null; error: "missing_env" | "invalid_env" | null } {
  const hashValue = readEnv("APP_ACCESS_KEY_HASH");
  if (hashValue) {
    const normalized = normalizeSha256Hex(hashValue);
    if (!normalized) return { config: null, error: "invalid_env" };
    return { config: { mode: "sha256", value: normalized }, error: null };
  }

  const rawKey = readEnv("APP_ACCESS_KEY");
  if (rawKey) {
    return { config: { mode: "raw", value: rawKey }, error: null };
  }

  return { config: null, error: "missing_env" };
}

function isValidAccessKey(providedKey: string, config: AccessKeyConfig): boolean {
  if (config.mode === "raw") {
    return timingSafeEqualText(providedKey, config.value);
  }

  const providedHash = createHash("sha256").update(providedKey).digest("hex");
  return timingSafeEqualText(providedHash, config.value);
}

function isPrivateOrLocalHost(host: string): boolean {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function shouldUseSecureCookie(req: VercelRequest): boolean {
  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  if (typeof forwardedProto === "string" && forwardedProto.trim()) {
    return forwardedProto.trim().toLowerCase() === "https";
  }

  const hostHeader = req.headers.host;
  const hostValue = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const hostname = typeof hostValue === "string" ? hostValue.split(":")[0].toLowerCase() : "";
  return !isPrivateOrLocalHost(hostname);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { config: accessKeyConfig, error } = resolveAccessKeyConfig();
  if (!accessKeyConfig || error) {
    return res.status(500).json({ ok: false, error: error ?? "missing_env" });
  }

  const providedKey = getKeyParam(req);
  if (!providedKey || !isValidAccessKey(providedKey, accessKeyConfig)) {
    res.writeHead(302, { Location: "/landing/" });
    return res.end();
  }

  const nextPath = sanitizeAppPath(getPathParam(req));
  const cookieParts = [
    `${ACCESS_COOKIE}=${ACCESS_COOKIE_VALUE}`,
    "Max-Age=2592000",
    "Path=/app",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (shouldUseSecureCookie(req)) {
    cookieParts.push("Secure");
  }
  res.setHeader("Set-Cookie", cookieParts.join("; "));
  res.writeHead(302, { Location: nextPath });
  return res.end();
}
