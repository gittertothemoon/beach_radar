import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyApiSecurityHeaders, readBearerToken, readEnv } from "./_lib/security.js";

const ACCESS_COOKIE = "br_app_access";
const ACCESS_COOKIE_VALUE = "1";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const accessToken = readBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ ok: false, error: "missing_token" });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

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
  return res.status(200).json({ ok: true });
}
