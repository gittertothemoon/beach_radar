import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readBearerToken, readEnv } from "../_lib/security.js";

const MAX_TOKEN_LENGTH = 512;
const MAX_BODY_BYTES = 4 * 1024;
const PUSH_TOKENS_TABLE = "user_push_tokens";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function readBody(req: VercelRequest): { body: Record<string, unknown> | null; error?: string } {
  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength && rawLength > MAX_BODY_BYTES) {
    return { body: null, error: "payload_too_large" };
  }
  if (!req.body) return { body: null, error: "missing_body" };
  if (typeof req.body === "string") {
    if (req.body.length > MAX_BODY_BYTES) return { body: null, error: "payload_too_large" };
    try {
      const parsed = JSON.parse(req.body);
      if (!isObject(parsed)) return { body: null, error: "invalid_body" };
      return { body: parsed };
    } catch {
      return { body: null, error: "invalid_json" };
    }
  }
  if (!isObject(req.body)) return { body: null, error: "invalid_body" };
  return { body: req.body };
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
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const accessToken = readBearerToken(req);
  if (!accessToken) return res.status(401).json({ ok: false, error: "missing_token" });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user?.id) {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
  const userId = userData.user.id;

  const { body, error: bodyError } = readBody(req);
  if (bodyError || !body) {
    return res.status(400).json({ ok: false, error: bodyError ?? "missing_body" });
  }

  const token = toSingleString(body.token);
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return res.status(400).json({ ok: false, error: "invalid_token_value" });
  }

  const rawPlatform = toSingleString(body.platform);
  const platform = rawPlatform === "ios" || rawPlatform === "android" ? rawPlatform : "unknown";

  const { error: upsertError } = await supabase
    .from(PUSH_TOKENS_TABLE)
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" },
    );

  if (upsertError) {
    return res.status(500).json({ ok: false, error: "db_upsert_failed" });
  }

  return res.status(200).json({ ok: true });
}
