import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";

const DOUBLE_OPT_IN_ENABLED = process.env.ENABLE_DOUBLE_OPTIN === "1";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getTokenParam(req: VercelRequest): string | null {
  const token = req.query.token;
  if (typeof token === "string") return token;
  if (Array.isArray(token) && token.length > 0) return token[0];
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!DOUBLE_OPT_IN_ENABLED) {
    return res.status(404).json({ ok: false, error: "not_enabled" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = getTokenParam(req);
  if (!token) {
    return res.status(400).json({ ok: false, error: "missing_token" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("waitlist_signups")
    .update({
      status: "confirmed",
      confirmed_at: nowIso,
      confirm_token_hash: null
    })
    .eq("confirm_token_hash", tokenHash)
    .select("id")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ ok: false, error: "db_update_failed" });
  }

  if (!data) {
    return res.status(400).json({ ok: false, error: "invalid_token" });
  }

  return res.status(200).json({ ok: true });
}
