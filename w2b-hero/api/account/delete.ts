import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readBearerToken, readEnv } from "../_lib/security.js";

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const configuredBase = normalizeOrigin(readEnv("VITE_PUBLIC_BASE_URL"));
  const allowedOrigins = new Set<string>([
    "https://where2beach.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  if (configuredBase) {
    allowedOrigins.add(configuredBase);
  }

  const requestOrigin = normalizeOrigin(
    typeof req.headers.origin === "string" ? req.headers.origin : null,
  );
  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "missing_token" });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(
    userData.user.id,
  );
  if (deleteError) {
    return res.status(500).json({ ok: false, error: "delete_failed" });
  }

  return res.status(200).json({ ok: true });
}
