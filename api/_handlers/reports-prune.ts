import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPORTS_TABLE = "beach_reports";
const DEFAULT_RETENTION_DAYS = 30;

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

function readIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function readBearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function isAuthorized(req: VercelRequest): boolean {
  const token = readBearerToken(req);
  if (!token) return false;

  const cronSecret = readEnv("CRON_SECRET");
  if (cronSecret) {
    return token === cronSecret;
  }

  const pruneToken = readEnv("REPORTS_PRUNE_TOKEN");
  if (!pruneToken) return false;
  return token === pruneToken;
}

function buildSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const supabase = buildSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const retentionDays = readIntEnv("REPORTS_RETENTION_DAYS", DEFAULT_RETENTION_DAYS, 1, 365);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const dryRun = req.query.dry === "1";

  if (dryRun) {
    const { count, error } = await supabase
      .from(REPORTS_TABLE)
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoff);
    if (error) {
      return res.status(500).json({ ok: false, error: "db_count_failed" });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      dryRun: true,
      candidateCount: count ?? 0,
      retentionDays,
      cutoff,
    });
  }

  const { count, error } = await supabase
    .from(REPORTS_TABLE)
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    return res.status(500).json({ ok: false, error: "db_delete_failed" });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    deleted: count ?? 0,
    retentionDays,
    cutoff,
  });
}
