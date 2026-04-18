/**
 * Cron endpoint: POST /api/notifications/daily-remind
 * Schedule: 18:00 UTC (20:00 CEST / 19:00 CET)
 * Sends a push notification to users who haven't yet claimed today's daily mission
 * and have a registered push token.
 */
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyApiSecurityHeaders,
  readBearerToken,
  readEnv,
  safeEqualSecret,
} from "../_lib/security.js";

const DAILY_MISSION_GOAL = 3;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH = 100; // Expo recommends batches ≤ 100

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
};

function isAuthorized(req: VercelRequest): boolean {
  const token = readBearerToken(req);
  if (!token) return false;
  const cronSecret = readEnv("CRON_SECRET");
  if (!cronSecret) return false;
  return safeEqualSecret(token, cronSecret);
}

function buildSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
}

async function sendPushBatch(messages: PushMessage[]): Promise<void> {
  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const supabase = buildSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  // Today's UTC day bounds
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

  // Users who have completed enough reports today for a daily mission (progress < DAILY_MISSION_GOAL)
  // We send to users who have a push token AND haven't yet claimed today's daily mission.
  // Query: users with push tokens LEFT JOIN daily mission claims for today.
  // Simple approach: get all users with push tokens, then filter server-side.

  const { data: tokenRows, error: tokenError } = await supabase
    .from("user_push_tokens")
    .select("user_id, token")
    .order("updated_at", { ascending: false });

  if (tokenError) {
    return res.status(500).json({ ok: false, error: "db_tokens_failed" });
  }

  if (!tokenRows || tokenRows.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, reason: "no_tokens" });
  }

  // Deduplicate: keep most-recent token per user
  const latestByUser = new Map<string, string>();
  for (const row of tokenRows as { user_id: string; token: string }[]) {
    if (!latestByUser.has(row.user_id)) {
      latestByUser.set(row.user_id, row.token);
    }
  }

  const userIds = [...latestByUser.keys()];

  // Users who already claimed today
  const { data: claimedRows, error: claimedError } = await supabase
    .from("user_daily_mission_claims")
    .select("user_id")
    .in("user_id", userIds)
    .gte("period_start", dayStart)
    .lte("period_start", dayEnd);

  if (claimedError) {
    return res.status(500).json({ ok: false, error: "db_claims_failed" });
  }

  const claimedSet = new Set((claimedRows ?? []).map((r: { user_id: string }) => r.user_id));

  // Users who have at least enough reports today to be eligible
  const { data: reportRows, error: reportError } = await supabase
    .from("points_ledger")
    .select("user_id")
    .in("user_id", userIds)
    .eq("reason", "report_completed")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (reportError) {
    return res.status(500).json({ ok: false, error: "db_reports_failed" });
  }

  // Count reports per user today
  const reportCounts = new Map<string, number>();
  for (const row of (reportRows ?? []) as { user_id: string }[]) {
    reportCounts.set(row.user_id, (reportCounts.get(row.user_id) ?? 0) + 1);
  }

  // Collect tokens for eligible users: have ≥1 report today, haven't claimed yet
  const messages: PushMessage[] = [];
  for (const [userId, token] of latestByUser) {
    if (claimedSet.has(userId)) continue; // already claimed
    const reportCount = reportCounts.get(userId) ?? 0;
    if (reportCount === 0) {
      // No reports today: send generic reminder
      messages.push({
        to: token,
        title: "Where2Beach",
        body: "Hai ancora tempo per la missione di oggi! Aggiorna una spiaggia e guadagna punti.",
        sound: "default",
        data: { type: "daily_reminder" },
      });
    } else if (reportCount < DAILY_MISSION_GOAL) {
      // Partial progress: encourage completion
      const remaining = DAILY_MISSION_GOAL - reportCount;
      messages.push({
        to: token,
        title: "Missione quasi completata!",
        body: `Sei a ${reportCount}/${DAILY_MISSION_GOAL} segnalazioni. Ancora ${remaining} e ritiri i punti bonus.`,
        sound: "default",
        data: { type: "daily_reminder_progress" },
      });
    }
    // If reportCount >= DAILY_MISSION_GOAL: mission complete but not claimed — this is handled by the in-app toast
  }

  if (messages.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, reason: "all_claimed_or_no_reports" });
  }

  // Send in batches
  let sent = 0;
  for (let i = 0; i < messages.length; i += MAX_BATCH) {
    const batch = messages.slice(i, i + MAX_BATCH);
    await sendPushBatch(batch);
    sent += batch.length;
  }

  return res.status(200).json({ ok: true, sent });
}
