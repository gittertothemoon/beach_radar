import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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

function readBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
