import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readBearerToken, readEnv } from "../_lib/security.js";

const BALANCES_TABLE = "user_points_balances";
const BADGE_CATALOG_TABLE = "badge_catalog";
const USER_BADGES_TABLE = "user_badges";
const POINTS_LEDGER_TABLE = "points_ledger";
const MISSION_CLAIMS_TABLE = "user_mission_claims";
const DAILY_MISSION_CLAIMS_TABLE = "user_daily_mission_claims";
const REPORT_COMPLETED_POINTS = 15;
const MAX_BADGE_CODE_LENGTH = 80;
const MAX_BODY_BYTES = 8 * 1024;
const WEEKLY_MISSION_GOAL = 10;
const WEEKLY_MISSION_REWARD = 20;
const DAILY_MISSION_GOAL = 3;
const DAILY_MISSION_REWARD = 5;

const ACHIEVEMENT_DEFS = [
  { id: "first_report", threshold: 1 },
  { id: "reporter_5", threshold: 5 },
  { id: "reporter_10", threshold: 10 },
  { id: "reporter_25", threshold: 25 },
  { id: "reporter_50", threshold: 50 },
] as const;

type RewardsSummary = {
  balance: number;
  pointsEarned: number;
  pointsSpent: number;
  reportPoints: number;
  ownedBadgesCount: number;
  badges: {
    code: string;
    name: string;
    description: string;
    icon: string;
    pointsCost: number;
    owned: boolean;
    ownedAt: string | null;
    redeemable: boolean;
  }[];
  couponConversion: {
    enabled: boolean;
    status: "coming_soon";
    message: string;
  };
  achievements: {
    id: string;
    threshold: number;
    unlocked: boolean;
  }[];
  weeklyMission: {
    goal: number;
    progress: number;
    reward: number;
    claimed: boolean;
    periodStart: string;
    periodEnd: string;
  };
  dailyMission: {
    goal: number;
    progress: number;
    reward: number;
    claimed: boolean;
    periodStart: string;
    periodEnd: string;
  };
  streak: {
    current: number;
    longestEver: number;
  };
};

type UserPointsBalanceRow = {
  points_balance?: unknown;
  points_earned?: unknown;
  points_spent?: unknown;
};

type BadgeCatalogRow = {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  icon?: unknown;
  points_cost?: unknown;
  sort_order?: unknown;
  active?: unknown;
};

type UserBadgeRow = {
  badge_code?: unknown;
  created_at?: unknown;
};

type RedeemBadgeFnRow = {
  ok?: unknown;
  error?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) {
        return item.trim();
      }
    }
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseBadgeRow(row: unknown): {
  code: string;
  name: string;
  description: string;
  icon: string;
  pointsCost: number;
  sortOrder: number;
} | null {
  if (!isObject(row)) return null;
  const badge = row as BadgeCatalogRow;
  const code = toSingleString(badge.code);
  const name = toSingleString(badge.name);
  const description = toSingleString(badge.description);
  const icon = toSingleString(badge.icon);
  const pointsCost = toFiniteNumber(badge.points_cost);
  const sortOrder = toFiniteNumber(badge.sort_order) ?? 999;
  if (!code || !name || !description || !icon || !pointsCost || pointsCost < 1) {
    return null;
  }
  return {
    code,
    name,
    description,
    icon,
    pointsCost: Math.round(pointsCost),
    sortOrder: Math.round(sortOrder),
  };
}

function parseUserBadgeRow(row: unknown): { badgeCode: string; ownedAt: string | null } | null {
  if (!isObject(row)) return null;
  const badge = row as UserBadgeRow;
  const badgeCode = toSingleString(badge.badge_code);
  if (!badgeCode) return null;
  return {
    badgeCode,
    ownedAt: typeof badge.created_at === "string" ? badge.created_at : null,
  };
}

function readBody(req: VercelRequest): { body: Record<string, unknown> | null; error?: string } {
  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength && rawLength > MAX_BODY_BYTES) {
    return { body: null, error: "payload_too_large" };
  }

  if (!req.body) return { body: null, error: "missing_body" };
  if (typeof req.body === "string") {
    if (req.body.length > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
    try {
      const parsed = JSON.parse(req.body);
      if (!isObject(parsed)) return { body: null, error: "invalid_body" };
      return { body: parsed };
    } catch {
      return { body: null, error: "invalid_json" };
    }
  }
  if (!isObject(req.body)) return { body: null, error: "invalid_body" };

  try {
    const size = JSON.stringify(req.body).length;
    if (size > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
  } catch {
    return { body: null, error: "invalid_body" };
  }

  return { body: req.body };
}

function getIsoWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay() || 7; // 1=Mon … 7=Sun
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999));
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

function getDayBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

async function ensureBalanceRow(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from(BALANCES_TABLE)
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  return !error;
}

async function loadRewardsSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; summary: RewardsSummary } | { ok: false; error: string }> {
  const balanceEnsured = await ensureBalanceRow(supabase, userId);
  if (!balanceEnsured) {
    return { ok: false, error: "db_balance_init_failed" };
  }

  const weekBounds = getIsoWeekBounds();
  const dayBounds = getDayBounds();

  const [
    { data: balanceData, error: balanceError },
    { data: badgeData, error: badgeError },
    { data: ownedData, error: ownedError },
    { count: totalReportCount, error: totalReportError },
    { count: weeklyReportCount, error: weeklyReportError },
    { count: missionClaimedCount, error: missionClaimedError },
    { count: dailyReportCount, error: dailyReportError },
    { count: dailyMissionClaimedCount, error: dailyMissionClaimedError },
    { data: streakData, error: streakError },
  ] = await Promise.all([
    supabase
      .from(BALANCES_TABLE)
      .select("points_balance, points_earned, points_spent")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from(BADGE_CATALOG_TABLE)
      .select("code, name, description, icon, points_cost, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from(USER_BADGES_TABLE)
      .select("badge_code, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from(POINTS_LEDGER_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "report_completed"),
    supabase
      .from(POINTS_LEDGER_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "report_completed")
      .gte("created_at", weekBounds.start)
      .lte("created_at", weekBounds.end),
    supabase
      .from(MISSION_CLAIMS_TABLE)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("period_start", weekBounds.start),
    supabase
      .from(POINTS_LEDGER_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "report_completed")
      .gte("created_at", dayBounds.start)
      .lte("created_at", dayBounds.end),
    supabase
      .from(DAILY_MISSION_CLAIMS_TABLE)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("period_start", dayBounds.start),
    supabase.rpc("get_user_daily_streak", { p_user_id: userId }),
  ]);

  if (balanceError) return { ok: false, error: "db_balance_fetch_failed" };
  if (badgeError) return { ok: false, error: "db_badges_fetch_failed" };
  if (ownedError) return { ok: false, error: "db_user_badges_fetch_failed" };
  if (totalReportError) return { ok: false, error: "db_ledger_fetch_failed" };
  if (weeklyReportError) return { ok: false, error: "db_ledger_fetch_failed" };
  if (missionClaimedError) return { ok: false, error: "db_mission_claims_fetch_failed" };
  if (dailyReportError) return { ok: false, error: "db_ledger_fetch_failed" };
  if (dailyMissionClaimedError) return { ok: false, error: "db_daily_mission_claims_fetch_failed" };
  // streakError is non-fatal — gracefully default to 0

  const balanceRow = isObject(balanceData) ? (balanceData as UserPointsBalanceRow) : {};
  const pointsBalance = Math.max(0, Math.round(toFiniteNumber(balanceRow.points_balance) ?? 0));
  const pointsEarned = Math.max(0, Math.round(toFiniteNumber(balanceRow.points_earned) ?? 0));
  const pointsSpent = Math.max(0, Math.round(toFiniteNumber(balanceRow.points_spent) ?? 0));

  const badges = (Array.isArray(badgeData) ? badgeData : [])
    .map((row) => parseBadgeRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof parseBadgeRow>> => row !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const ownedRows = (Array.isArray(ownedData) ? ownedData : [])
    .map((row) => parseUserBadgeRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof parseUserBadgeRow>> => row !== null);
  const ownedMap = new Map(ownedRows.map((row) => [row.badgeCode, row]));

  const totalReports = Math.max(0, totalReportCount ?? 0);
  const weeklyReports = Math.max(0, Math.min(WEEKLY_MISSION_GOAL, weeklyReportCount ?? 0));
  const dailyReports = Math.max(0, Math.min(DAILY_MISSION_GOAL, dailyReportCount ?? 0));

  const streakRow = !streakError && Array.isArray(streakData) && streakData.length > 0
    ? (streakData[0] as { current_streak?: unknown; longest_streak?: unknown })
    : null;
  const currentStreak = Math.max(0, toFiniteNumber(streakRow?.current_streak) ?? 0);
  const longestStreak = Math.max(0, toFiniteNumber(streakRow?.longest_streak) ?? 0);

  const summary: RewardsSummary = {
    balance: pointsBalance,
    pointsEarned,
    pointsSpent,
    reportPoints: REPORT_COMPLETED_POINTS,
    ownedBadgesCount: ownedRows.length,
    badges: badges.map((badge) => {
      const owned = ownedMap.get(badge.code);
      return {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        pointsCost: badge.pointsCost,
        owned: Boolean(owned),
        ownedAt: owned?.ownedAt ?? null,
        redeemable: !owned && pointsBalance >= badge.pointsCost,
      };
    }),
    couponConversion: {
      enabled: false,
      status: "coming_soon",
      message:
        "Presto i punti si convertiranno anche in coupon per lidi e partner convenzionati.",
    },
    achievements: ACHIEVEMENT_DEFS.map((def) => ({
      id: def.id,
      threshold: def.threshold,
      unlocked: totalReports >= def.threshold,
    })),
    weeklyMission: {
      goal: WEEKLY_MISSION_GOAL,
      progress: weeklyReports,
      reward: WEEKLY_MISSION_REWARD,
      claimed: (missionClaimedCount ?? 0) > 0,
      periodStart: weekBounds.start,
      periodEnd: weekBounds.end,
    },
    dailyMission: {
      goal: DAILY_MISSION_GOAL,
      progress: dailyReports,
      reward: DAILY_MISSION_REWARD,
      claimed: (dailyMissionClaimedCount ?? 0) > 0,
      periodStart: dayBounds.start,
      periodEnd: dayBounds.end,
    },
    streak: {
      current: currentStreak,
      longestEver: longestStreak,
    },
  };

  return { ok: true, summary };
}

async function authenticateUser(
  req: VercelRequest,
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = buildSupabaseClient();
  if (!supabase) {
    return { ok: false, status: 500, error: "missing_env" };
  }

  const accessToken = readBearerToken(req);
  if (!accessToken) {
    return { ok: false, status: 401, error: "missing_token" };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user?.id) {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  return { ok: true, supabase, userId: userData.user.id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const auth = await authenticateUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  const { supabase, userId } = auth;

  if (req.method === "GET") {
    const summaryResult = await loadRewardsSummary(supabase, userId);
    if (!summaryResult.ok) {
      return res.status(500).json({ ok: false, error: summaryResult.error });
    }
    return res.status(200).json({ ok: true, summary: summaryResult.summary });
  }

  const { body, error: bodyError } = readBody(req);
  if (bodyError) {
    const status = bodyError === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error: bodyError });
  }
  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const action = toSingleString(body.action);

  // ── Claim weekly mission reward ──────────────────────────────────────────
  if (action === "claim_mission") {
    const weekBounds = getIsoWeekBounds();
    const weeklyCount = await (async () => {
      const { count, error } = await supabase
        .from(POINTS_LEDGER_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reason", "report_completed")
        .gte("created_at", weekBounds.start)
        .lte("created_at", weekBounds.end);
      return error ? 0 : (count ?? 0);
    })();

    if (weeklyCount < WEEKLY_MISSION_GOAL) {
      return res.status(409).json({ ok: false, error: "mission_not_complete" });
    }

    type ClaimFnRow = { ok?: unknown; error?: unknown };
    const { data: claimData, error: claimError } = await supabase.rpc(
      "claim_weekly_mission_reward",
      {
        p_user_id: userId,
        p_period_start: weekBounds.start,
        p_points: WEEKLY_MISSION_REWARD,
      },
    );
    if (claimError) {
      return res.status(500).json({ ok: false, error: "mission_claim_failed" });
    }
    const claimRow = isObject(claimData) ? (claimData as ClaimFnRow) : null;
    if (claimRow?.ok !== true) {
      const claimErrCode = toSingleString(claimRow?.error);
      const status = claimErrCode === "already_claimed" ? 409 : 400;
      return res.status(status).json({ ok: false, error: claimErrCode ?? "mission_claim_failed" });
    }

    const summaryResult = await loadRewardsSummary(supabase, userId);
    if (!summaryResult.ok) {
      return res.status(500).json({ ok: false, error: summaryResult.error });
    }
    return res.status(200).json({ ok: true, summary: summaryResult.summary });
  }

  // ── Claim daily mission reward ───────────────────────────────────────────
  if (action === "claim_daily_mission") {
    const dayBounds = getDayBounds();
    const dailyCount = await (async () => {
      const { count, error } = await supabase
        .from(POINTS_LEDGER_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reason", "report_completed")
        .gte("created_at", dayBounds.start)
        .lte("created_at", dayBounds.end);
      return error ? 0 : (count ?? 0);
    })();

    if (dailyCount < DAILY_MISSION_GOAL) {
      return res.status(409).json({ ok: false, error: "mission_not_complete" });
    }

    type ClaimFnRow = { ok?: unknown; error?: unknown };
    const { data: claimData, error: claimError } = await supabase.rpc(
      "claim_daily_mission_reward",
      {
        p_user_id: userId,
        p_period_start: dayBounds.start,
        p_points: DAILY_MISSION_REWARD,
      },
    );
    if (claimError) {
      return res.status(500).json({ ok: false, error: "mission_claim_failed" });
    }
    const claimRow = isObject(claimData) ? (claimData as ClaimFnRow) : null;
    if (claimRow?.ok !== true) {
      const claimErrCode = toSingleString(claimRow?.error);
      const status = claimErrCode === "already_claimed" ? 409 : 400;
      return res.status(status).json({ ok: false, error: claimErrCode ?? "mission_claim_failed" });
    }

    const summaryResult = await loadRewardsSummary(supabase, userId);
    if (!summaryResult.ok) {
      return res.status(500).json({ ok: false, error: summaryResult.error });
    }
    return res.status(200).json({ ok: true, summary: summaryResult.summary });
  }

  // ── Redeem badge ─────────────────────────────────────────────────────────
  const badgeCode = toSingleString(body.badgeCode);
  if (!badgeCode || badgeCode.length > MAX_BADGE_CODE_LENGTH) {
    return res.status(400).json({ ok: false, error: "invalid_badge_code" });
  }

  const { data: redeemData, error: redeemError } = await supabase.rpc(
    "redeem_badge_points",
    { p_user_id: userId, p_badge_code: badgeCode },
  );
  if (redeemError) {
    return res.status(500).json({ ok: false, error: "badge_redeem_failed" });
  }

  const firstRow = Array.isArray(redeemData) ? redeemData[0] : redeemData;
  const redeemRow = isObject(firstRow) ? (firstRow as RedeemBadgeFnRow) : null;
  const redeemOk = redeemRow?.ok === true;
  const redeemErrorCode = toSingleString(redeemRow?.error);

  if (!redeemOk) {
    const status =
      redeemErrorCode === "badge_not_found"
        ? 404
        : redeemErrorCode === "invalid_badge_code"
          ? 400
          : redeemErrorCode === "insufficient_points" || redeemErrorCode === "badge_already_owned"
            ? 409
            : 400;
    return res.status(status).json({
      ok: false,
      error: redeemErrorCode ?? "badge_redeem_failed",
    });
  }

  const summaryResult = await loadRewardsSummary(supabase, userId);
  if (!summaryResult.ok) {
    return res.status(500).json({ ok: false, error: summaryResult.error });
  }

  return res.status(200).json({
    ok: true,
    summary: summaryResult.summary,
  });
}
