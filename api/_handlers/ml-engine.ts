import { createClient } from "@supabase/supabase-js";
import { readEnv } from "../_lib/security.js";

const BEACH_FILTER_WEIGHTS_TABLE = "beach_filter_weights";
const BEACH_TIME_PATTERNS_TABLE = "beach_time_patterns";
const BEACH_ANOMALIES_TABLE = "beach_anomalies";
const PREDICTION_ACCURACY_TABLE = "prediction_accuracy_log";
const BEACH_REPORTS_TABLE = "beach_reports";
const CROWD_PREDICTIONS_TABLE = "crowd_predictions";
const USER_REPUTATION_TABLE = "user_reputation";

// Adaptive weights kick in only after this many per-beach reports
const MIN_REPORTS_FOR_ADAPTATION = 20;
// EMA alpha: 0.05 = slow stable adaptation
const WEIGHT_EMA_ALPHA = 0.05;
const DEFAULT_WEIGHTS: FilterWeights = { gps: 0.30, reputation: 0.25, environmental: 0.20, crossConfirm: 0.25 };
const WEIGHT_MIN = 0.10;
const WEIGHT_MAX = 0.50;
const ANOMALY_Z_THRESHOLD = 2.0;
const ANOMALY_TTL_MS = 2 * 60 * 60 * 1000; // 2h

export type FilterWeights = {
  gps: number;
  reputation: number;
  environmental: number;
  crossConfirm: number;
};

export type UserReputationTier = "super" | "normal" | "new";

export function buildMlSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
}

type SupabaseClient = ReturnType<typeof buildMlSupabaseClient>;

export async function loadAdaptiveWeights(
  beachId: string,
  supabase: SupabaseClient,
): Promise<FilterWeights> {
  if (!supabase) return { ...DEFAULT_WEIGHTS };
  const { data } = await supabase
    .from(BEACH_FILTER_WEIGHTS_TABLE)
    .select("w_gps, w_reputation, w_environmental, w_cross_confirm, report_count")
    .eq("beach_id", beachId)
    .maybeSingle();
  if (!data || (data.report_count as number) < MIN_REPORTS_FOR_ADAPTATION) {
    return { ...DEFAULT_WEIGHTS };
  }
  return {
    gps: typeof data.w_gps === "number" ? data.w_gps : DEFAULT_WEIGHTS.gps,
    reputation: typeof data.w_reputation === "number" ? data.w_reputation : DEFAULT_WEIGHTS.reputation,
    environmental: typeof data.w_environmental === "number" ? data.w_environmental : DEFAULT_WEIGHTS.environmental,
    crossConfirm: typeof data.w_cross_confirm === "number" ? data.w_cross_confirm : DEFAULT_WEIGHTS.crossConfirm,
  };
}

function normalizeWeights(raw: FilterWeights): FilterWeights {
  // Clamp each weight then re-normalize so they sum to 1
  const clamped = {
    gps: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw.gps)),
    reputation: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw.reputation)),
    environmental: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw.environmental)),
    crossConfirm: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw.crossConfirm)),
  };
  const total = clamped.gps + clamped.reputation + clamped.environmental + clamped.crossConfirm;
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  return {
    gps: clamped.gps / total,
    reputation: clamped.reputation / total,
    environmental: clamped.environmental / total,
    crossConfirm: clamped.crossConfirm / total,
  };
}

export async function updateAdaptiveWeights(
  beachId: string,
  filterScores: FilterWeights,
  consensusVerified: boolean,
  supabase: SupabaseClient,
): Promise<void> {
  if (!supabase) return;
  const { data: existing } = await supabase
    .from(BEACH_FILTER_WEIGHTS_TABLE)
    .select("acc_gps, acc_reputation, acc_environmental, acc_cross_confirm, report_count")
    .eq("beach_id", beachId)
    .maybeSingle();

  const prevAccGps = typeof existing?.acc_gps === "number" ? existing.acc_gps : 0.65;
  const prevAccRep = typeof existing?.acc_reputation === "number" ? existing.acc_reputation : 0.65;
  const prevAccEnv = typeof existing?.acc_environmental === "number" ? existing.acc_environmental : 0.65;
  const prevAccCross = typeof existing?.acc_cross_confirm === "number" ? existing.acc_cross_confirm : 0.65;
  const reportCount = typeof existing?.report_count === "number" ? existing.report_count : 0;

  // Each filter is "correct" if its high/low verdict agreed with the final consensus
  const alignedGps = (filterScores.gps >= 0.6) === consensusVerified ? 1.0 : 0.0;
  const alignedRep = (filterScores.reputation >= 0.6) === consensusVerified ? 1.0 : 0.0;
  const alignedEnv = (filterScores.environmental >= 0.6) === consensusVerified ? 1.0 : 0.0;
  const alignedCross = (filterScores.crossConfirm >= 0.6) === consensusVerified ? 1.0 : 0.0;

  const alpha = WEIGHT_EMA_ALPHA;
  const newAccGps = alpha * alignedGps + (1 - alpha) * prevAccGps;
  const newAccRep = alpha * alignedRep + (1 - alpha) * prevAccRep;
  const newAccEnv = alpha * alignedEnv + (1 - alpha) * prevAccEnv;
  const newAccCross = alpha * alignedCross + (1 - alpha) * prevAccCross;

  // Derive weights proportional to accuracy, clamped and normalized
  const normalized = normalizeWeights({
    gps: newAccGps,
    reputation: newAccRep,
    environmental: newAccEnv,
    crossConfirm: newAccCross,
  });

  await supabase.from(BEACH_FILTER_WEIGHTS_TABLE).upsert(
    {
      beach_id: beachId,
      w_gps: normalized.gps,
      w_reputation: normalized.reputation,
      w_environmental: normalized.environmental,
      w_cross_confirm: normalized.crossConfirm,
      acc_gps: newAccGps,
      acc_reputation: newAccRep,
      acc_environmental: newAccEnv,
      acc_cross_confirm: newAccCross,
      report_count: reportCount + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "beach_id" },
  );
}

export async function detectAndStoreAnomaly(
  beachId: string,
  crowdLevel: number,
  reportId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (!supabase) return false;
  const now = new Date();
  const dow = now.getUTCDay();
  const hour = now.getUTCHours();

  const { data: pattern } = await supabase
    .from(BEACH_TIME_PATTERNS_TABLE)
    .select("avg_crowd_level, stddev_crowd, sample_count")
    .eq("beach_id", beachId)
    .eq("day_of_week", dow)
    .eq("hour_of_day", hour)
    .maybeSingle();

  if (!pattern || (pattern.sample_count as number) < 5) return false;

  const expected = pattern.avg_crowd_level as number;
  const stddev = Math.max(0.3, pattern.stddev_crowd as number);
  const zScore = (crowdLevel - expected) / stddev;

  if (Math.abs(zScore) < ANOMALY_Z_THRESHOLD) return false;

  await supabase.from(BEACH_ANOMALIES_TABLE).upsert(
    {
      beach_id: beachId,
      detected_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ANOMALY_TTL_MS).toISOString(),
      crowd_level: crowdLevel,
      expected_level: expected,
      z_score: zScore,
      report_id: reportId,
    },
    { onConflict: "beach_id,detected_at" },
  );

  return true;
}

export async function getActiveAnomaly(
  beachId: string,
  supabase: SupabaseClient,
): Promise<{ zScore: number; crowdLevel: number } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from(BEACH_ANOMALIES_TABLE)
    .select("z_score, crowd_level")
    .eq("beach_id", beachId)
    .gt("expires_at", new Date().toISOString())
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { zScore: data.z_score as number, crowdLevel: data.crowd_level as number };
}

export async function getUserReputationTier(
  userId: string | null,
  supabase: SupabaseClient,
): Promise<UserReputationTier> {
  if (!userId || !supabase) return "new";
  const { data } = await supabase
    .from(USER_REPUTATION_TABLE)
    .select("total_reports, verified_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "new";
  const total = typeof data.total_reports === "number" ? data.total_reports : 0;
  const verified = typeof data.verified_count === "number" ? data.verified_count : 0;
  if (total < 5) return "new";
  if (total >= 10 && total > 0 && verified / total >= 0.70) return "super";
  return "normal";
}

export async function loadAllTimePatterns(
  beachId: string,
  supabase: SupabaseClient,
): Promise<Map<string, { avgCrowdLevel: number; sampleCount: number }>> {
  if (!supabase) return new Map();
  const { data } = await supabase
    .from(BEACH_TIME_PATTERNS_TABLE)
    .select("day_of_week, hour_of_day, avg_crowd_level, sample_count")
    .eq("beach_id", beachId)
    .gte("sample_count", 5);
  const map = new Map<string, { avgCrowdLevel: number; sampleCount: number }>();
  if (!Array.isArray(data)) return map;
  for (const row of data) {
    const key = `${row.day_of_week}:${row.hour_of_day}`;
    map.set(key, {
      avgCrowdLevel: row.avg_crowd_level as number,
      sampleCount: row.sample_count as number,
    });
  }
  return map;
}

export async function refreshTimePatterns(
  beachId: string,
  supabase: SupabaseClient,
): Promise<number> {
  if (!supabase) return 0;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reports } = await supabase
    .from(BEACH_REPORTS_TABLE)
    .select("crowd_level, created_at")
    .eq("beach_id", beachId)
    .eq("consensus_status", "verified")
    .gte("created_at", sixMonthsAgo)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (!Array.isArray(reports) || reports.length === 0) return 0;

  const buckets = new Map<string, number[]>();
  for (const r of reports) {
    const d = new Date(r.created_at as string);
    const key = `${d.getUTCDay()}:${d.getUTCHours()}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r.crowd_level as number);
  }

  type PatternRow = {
    beach_id: string;
    day_of_week: number;
    hour_of_day: number;
    avg_crowd_level: number;
    stddev_crowd: number;
    sample_count: number;
    computed_at: string;
  };
  const rows: PatternRow[] = [];
  const now = new Date().toISOString();

  for (const [key, values] of buckets) {
    if (values.length < 3) continue;
    const [dowStr, hourStr] = key.split(":");
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
    rows.push({
      beach_id: beachId,
      day_of_week: parseInt(dowStr, 10),
      hour_of_day: parseInt(hourStr, 10),
      avg_crowd_level: Math.round(avg * 100) / 100,
      stddev_crowd: Math.round(Math.sqrt(variance) * 100) / 100,
      sample_count: values.length,
      computed_at: now,
    });
  }

  if (rows.length === 0) return 0;
  await supabase
    .from(BEACH_TIME_PATTERNS_TABLE)
    .upsert(rows, { onConflict: "beach_id,day_of_week,hour_of_day" });
  return rows.length;
}

function crowdLevelToIndex(level: number): number {
  return Math.round((level - 0.5) * 25);
}

export async function evaluatePredictionAccuracy(
  supabase: SupabaseClient,
): Promise<number> {
  if (!supabase) return 0;

  // Evaluate predictions whose target time has passed but is recent enough to have actual data
  const windowEnd = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: predictions } = await supabase
    .from(CROWD_PREDICTIONS_TABLE)
    .select("beach_id, target_time, crowd_index")
    .gte("target_time", windowStart)
    .lte("target_time", windowEnd);

  if (!Array.isArray(predictions) || predictions.length === 0) return 0;

  let evaluated = 0;
  for (const pred of predictions) {
    const targetMs = Date.parse(pred.target_time as string);
    if (!Number.isFinite(targetMs)) continue;

    const actualStart = new Date(targetMs - 30 * 60 * 1000).toISOString();
    const actualEnd = new Date(targetMs + 30 * 60 * 1000).toISOString();

    const { data: actuals } = await supabase
      .from(BEACH_REPORTS_TABLE)
      .select("crowd_level")
      .eq("beach_id", pred.beach_id)
      .gte("created_at", actualStart)
      .lte("created_at", actualEnd)
      .eq("consensus_status", "verified");

    if (!Array.isArray(actuals) || actuals.length === 0) continue;

    const actualAvg =
      actuals.reduce((s, r) => s + crowdLevelToIndex(r.crowd_level as number), 0) / actuals.length;
    const absoluteError = Math.abs((pred.crowd_index as number) - actualAvg);

    await supabase.from(PREDICTION_ACCURACY_TABLE).upsert(
      {
        beach_id: pred.beach_id,
        target_time: pred.target_time,
        predicted_crowd_index: pred.crowd_index,
        actual_crowd_index: Math.round(actualAvg * 10) / 10,
        absolute_error: Math.round(absoluteError * 10) / 10,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: "beach_id,target_time" },
    );
    evaluated++;
  }
  return evaluated;
}

export async function refreshActiveBeachPatterns(
  supabase: SupabaseClient,
): Promise<number> {
  if (!supabase) return 0;
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: activeBeaches } = await supabase
    .from(BEACH_REPORTS_TABLE)
    .select("beach_id")
    .gte("created_at", dayAgo)
    .limit(50);

  if (!Array.isArray(activeBeaches)) return 0;
  const unique = [...new Set(activeBeaches.map((r) => r.beach_id as string))];

  let refreshed = 0;
  for (const beachId of unique) {
    const count = await refreshTimePatterns(beachId, supabase);
    if (count > 0) refreshed++;
  }
  return refreshed;
}
