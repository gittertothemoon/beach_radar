import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const CAP = 1000;
const TEST_MODE = process.env.WAITLIST_TEST_MODE === "1";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (TEST_MODE) {
    return res.status(200).json({ ok: true, count: 0, cap: CAP, remaining: CAP });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const { count, error } = await supabase
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true })
    .neq("status", "spam");

  if (error) {
    return res.status(500).json({ ok: false, error: "db_count_failed" });
  }

  const safeCount = typeof count === "number" ? count : 0;
  const remaining = Math.max(0, CAP - safeCount);
  return res.status(200).json({ ok: true, count: safeCount, cap: CAP, remaining });
}
