import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders } from "./_lib/security.js";
import {
  buildSupabaseClient,
  cachePredictions,
  computePredictions,
  getCachedPredictions,
  pruneExpiredPredictions,
} from "./_handlers/crowd-predictions.js";

const MAX_HOURS = 12;
const DEFAULT_HOURS = 8;

function toQueryString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim() || null;
  return null;
}

function parseCoord(value: unknown, min: number, max: number): number | null {
  const raw = toQueryString(value);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function parseHours(value: unknown): number {
  const raw = toQueryString(value);
  if (!raw) return DEFAULT_HOURS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_HOURS;
  return Math.min(n, MAX_HOURS);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res);

  // POST ?action=prune — cron endpoint to delete expired predictions
  if (req.method === "POST") {
    const action = toQueryString(req.query.action);
    if (action !== "prune") {
      return res.status(400).json({ ok: false, error: "unknown_action" });
    }
    const supabase = buildSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }
    const pruned = await pruneExpiredPredictions(supabase);
    applyApiSecurityHeaders(res, { noStore: true });
    return res.status(200).json({ ok: true, pruned });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const beachId = toQueryString(req.query.beach_id);
  if (!beachId || beachId.length > 96) {
    return res.status(400).json({ ok: false, error: "invalid_beach_id" });
  }

  const lat = parseCoord(req.query.lat, -90, 90);
  const lng = parseCoord(req.query.lng, -180, 180);
  const hours = parseHours(req.query.hours);

  const supabase = buildSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const now = new Date();

  // Build target hour list
  const targetTimes: Date[] = [];
  for (let h = 1; h <= hours; h++) {
    const t = new Date(now);
    t.setMinutes(0, 0, 0);
    t.setUTCHours(t.getUTCHours() + h);
    targetTimes.push(t);
  }

  // Check cache first
  const cached = await getCachedPredictions(beachId, targetTimes, supabase);

  // Find hours that need fresh computation
  const uncachedTimes = targetTimes.filter((t) => !cached.has(t.toISOString()));

  let freshPredictions: Awaited<ReturnType<typeof computePredictions>> = [];
  if (uncachedTimes.length > 0) {
    // Compute only for uncached target times by clamping the hours count
    // (computePredictions always starts from now+1, so we adjust)
    freshPredictions = await computePredictions(beachId, lat, lng, hours, supabase);

    // Filter to only the uncached ones before persisting
    const uncachedIsos = new Set(uncachedTimes.map((t) => t.toISOString()));
    const toCache = freshPredictions.filter((p) => uncachedIsos.has(p.targetTime));
    await cachePredictions(beachId, toCache, now.getTime(), supabase);
  }

  // Merge cached + fresh, sorted by target time
  const allPredictions = targetTimes.map((t) => {
    const iso = t.toISOString();
    return (
      cached.get(iso) ??
      freshPredictions.find((p) => p.targetTime === iso) ??
      null
    );
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
  return res.status(200).json({ ok: true, beachId, predictions: allPredictions });
}
