import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readTestModeStore, updateTestModeStore } from "./test-mode-store.js";
import { applyApiSecurityHeaders, readBearerToken, readEnv } from "../_lib/security.js";

const REPORTS_TABLE = "beach_reports";
const MAX_BODY_BYTES = 8 * 1024;
const DEFAULT_REPORT_RATE_LIMIT_MIN = 10;
const DEFAULT_REPORTS_LOOKBACK_HOURS = 6;
const DEFAULT_REPORTS_GET_LIMIT = 5000;
const MAX_BEACH_ID_LENGTH = 96;
const MAX_REPORTER_HASH_LENGTH = 128;
const REPORT_COMPLETED_POINTS = 15;
const TEST_MODE_MAX_REPORTS = 5000;
const REPORTS_TEST_STORE_FILE = "reports-state.json";
const TEST_MODE = process.env.REPORTS_TEST_MODE === "1";
const REPORT_RATE_LIMIT_MIN = readIntEnv(
  "REPORTS_RATE_LIMIT_MIN",
  DEFAULT_REPORT_RATE_LIMIT_MIN,
  1,
  60,
);
const REPORTS_LOOKBACK_HOURS = readIntEnv(
  "REPORTS_LOOKBACK_HOURS",
  DEFAULT_REPORTS_LOOKBACK_HOURS,
  1,
  48,
);
const REPORTS_GET_LIMIT = readIntEnv(
  "REPORTS_GET_LIMIT",
  DEFAULT_REPORTS_GET_LIMIT,
  100,
  10000,
);
const REPORTS_HASH_SALT = readEnv("REPORTS_HASH_SALT");

type ReportRow = {
  id: string;
  beach_id: string;
  crowd_level: number;
  water_condition?: number | null;
  beach_condition?: number | null;
  created_at: string;
  attribution: unknown;
  reporter_hash?: string;
};

type PublicReport = {
  id: string;
  beachId: string;
  crowdLevel: 1 | 2 | 3 | 4;
  waterCondition?: 1 | 2 | 3 | 4;
  beachCondition?: 1 | 2 | 3;
  hasJellyfish?: boolean;
  hasAlgae?: boolean;
  createdAt: number;
  attribution?: unknown;
};

type ReportRewardSummary = {
  awardedPoints: number;
  pointsBalance: number | null;
};

type ReportsTestStore = {
  reports: ReportRow[];
};

function createReportsTestStore(): ReportsTestStore {
  return { reports: [] };
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

function parseCrowdLevel(value: unknown): 1 | 2 | 3 | 4 | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) {
    return numeric;
  }
  return null;
}

function parseWaterLevel(value: unknown): 1 | 2 | 3 | 4 | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) {
    return numeric;
  }
  return null;
}

function parseBeachLevel(value: unknown): 1 | 2 | 3 | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 1 || numeric === 2 || numeric === 3) {
    return numeric;
  }
  return null;
}

function parseOptionalBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

function sanitizeAttribution(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null;

  const next: Record<string, unknown> = {};
  const allowed = [
    "v",
    "src",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "first_seen_at",
    "last_seen_at",
    "has_jellyfish",
    "has_algae",
  ];

  for (const key of allowed) {
    const raw = value[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 0) next[key] = trimmed;
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean") {
      next[key] = raw;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function mergeAttributionFlags(
  attribution: Record<string, unknown> | null,
  hasJellyfish: boolean | undefined,
  hasAlgae: boolean | undefined,
): Record<string, unknown> | null {
  const merged: Record<string, unknown> = {
    ...(attribution ?? {}),
  };
  if (hasJellyfish !== undefined) {
    merged.has_jellyfish = hasJellyfish;
  }
  if (hasAlgae !== undefined) {
    merged.has_algae = hasAlgae;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

function getClientIp(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const remote = req.socket?.remoteAddress;
  return typeof remote === "string" ? remote : null;
}

function hashValue(raw: string, namespace: "ip" | "ua" | "reporter"): string {
  const payload = REPORTS_HASH_SALT
    ? `${namespace}:${REPORTS_HASH_SALT}:${raw}`
    : `${namespace}:${raw}`;
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

function anonymizeHeaderValue(
  value: string | null,
  namespace: "ip" | "ua",
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return hashValue(trimmed, namespace);
}

function toReporterHash(identity: string): string {
  return hashValue(identity, "reporter");
}

function toReportRow(value: unknown): ReportRow | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : null;
  const beachId = typeof value.beach_id === "string" ? value.beach_id : null;
  const crowdLevel =
    typeof value.crowd_level === "number" ? value.crowd_level : null;
  const waterCondition =
    typeof value.water_condition === "number" ? value.water_condition : null;
  const beachCondition =
    typeof value.beach_condition === "number" ? value.beach_condition : null;
  const createdAt = typeof value.created_at === "string" ? value.created_at : null;
  if (!id || !beachId || !crowdLevel || !createdAt) return null;
  return {
    id,
    beach_id: beachId,
    crowd_level: crowdLevel,
    water_condition: waterCondition,
    beach_condition: beachCondition,
    created_at: createdAt,
    attribution: value.attribution,
    reporter_hash:
      typeof value.reporter_hash === "string" ? value.reporter_hash : undefined,
  };
}

function toPublicReport(row: ReportRow): PublicReport | null {
  const crowdLevel = parseCrowdLevel(row.crowd_level);
  if (!crowdLevel) return null;
  const createdAt = Date.parse(row.created_at);
  if (!Number.isFinite(createdAt)) return null;
  const attribution = isObject(row.attribution) ? row.attribution : null;
  const hasJellyfishRaw =
    parseOptionalBoolean(attribution?.has_jellyfish) ??
    parseOptionalBoolean(attribution?.hasJellyfish);
  const hasAlgaeRaw =
    parseOptionalBoolean(attribution?.has_algae) ??
    parseOptionalBoolean(attribution?.hasAlgae);

  return {
    id: row.id,
    beachId: row.beach_id,
    crowdLevel,
    waterCondition: parseWaterLevel(row.water_condition) ?? undefined,
    beachCondition: parseBeachLevel(row.beach_condition) ?? undefined,
    hasJellyfish: typeof hasJellyfishRaw === "boolean" ? hasJellyfishRaw : undefined,
    hasAlgae: typeof hasAlgaeRaw === "boolean" ? hasAlgaeRaw : undefined,
    createdAt,
    attribution: row.attribution ?? undefined,
  };
}

function readBody(req: VercelRequest): {
  body: Record<string, unknown> | null;
  error?: string;
} {
  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength && rawLength > MAX_BODY_BYTES) {
    return { body: null, error: "payload_too_large" };
  }

  if (!req.body) {
    return { body: null, error: "missing_body" };
  }

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

  if (!isObject(req.body)) {
    return { body: null, error: "invalid_body" };
  }

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

function buildSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

function getRateRetryAfterSec(): number {
  return REPORT_RATE_LIMIT_MIN * 60;
}

function getLookbackIso(): string {
  const lookbackMs = REPORTS_LOOKBACK_HOURS * 60 * 60 * 1000;
  return new Date(Date.now() - lookbackMs).toISOString();
}

function sendTooSoon(res: VercelResponse) {
  const retryAfter = getRateRetryAfterSec();
  res.setHeader("Retry-After", String(retryAfter));
  return res.status(429).json({
    ok: false,
    error: "too_soon",
    retry_after: retryAfter,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res);

  if (req.method === "GET") {
    const lookbackIso = getLookbackIso();

    if (TEST_MODE) {
      const state = readTestModeStore(
        REPORTS_TEST_STORE_FILE,
        createReportsTestStore,
      );
      const reports = state.reports
        .filter((report) => report.created_at >= lookbackIso)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((row) => toPublicReport(row))
        .filter((row): row is PublicReport => row !== null);

      res.setHeader(
        "Cache-Control",
        "public, max-age=0, s-maxage=8, stale-while-revalidate=15",
      );
      return res.status(200).json({ ok: true, reports });
    }

    const supabase = buildSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }

    const { data, error } = await supabase
      .from(REPORTS_TABLE)
      .select("id, beach_id, crowd_level, water_condition, beach_condition, created_at, attribution")
      .gte("created_at", lookbackIso)
      .order("created_at", { ascending: false })
      .limit(REPORTS_GET_LIMIT);

    if (error) {
      return res.status(500).json({ ok: false, error: "db_fetch_failed" });
    }

    const reports = (Array.isArray(data) ? data : [])
      .map((row) => toReportRow(row))
      .filter((row): row is ReportRow => row !== null)
      .map((row) => toPublicReport(row))
      .filter((row): row is PublicReport => row !== null);

    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=8, stale-while-revalidate=15",
    );
    return res.status(200).json({ ok: true, reports });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  applyApiSecurityHeaders(res, { noStore: true });

  let reporterHash: string;
  let reporterUserId: string | null = null;
  let supabase = null as ReturnType<typeof buildSupabaseClient>;

  if (TEST_MODE) {
    const accessToken = readBearerToken(req);
    if (!accessToken) {
      return res.status(403).json({ ok: false, error: "account_required" });
    }
    reporterHash = toReporterHash(`test:${accessToken}`);
    reporterUserId = `test:${accessToken}`;
  } else {
    supabase = buildSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }

    const accessToken = readBearerToken(req);
    if (!accessToken) {
      return res.status(403).json({ ok: false, error: "account_required" });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user?.id) {
      return res.status(403).json({ ok: false, error: "account_required" });
    }
    reporterUserId = userData.user.id;
    reporterHash = toReporterHash(reporterUserId);
  }

  const { body, error: bodyError } = readBody(req);
  if (bodyError) {
    const status = bodyError === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error: bodyError });
  }
  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const beachId = toSingleString(body.beachId);
  if (!beachId || beachId.length > MAX_BEACH_ID_LENGTH) {
    return res.status(400).json({ ok: false, error: "invalid_beach_id" });
  }

  const crowdLevel = parseCrowdLevel(body.crowdLevel);
  if (!crowdLevel) {
    return res.status(400).json({ ok: false, error: "invalid_crowd_level" });
  }

  const waterCondition = body.waterCondition !== undefined ? parseWaterLevel(body.waterCondition) : undefined;
  if (body.waterCondition !== undefined && !waterCondition) {
    return res.status(400).json({ ok: false, error: "invalid_water_condition" });
  }

  const beachCondition = body.beachCondition !== undefined ? parseBeachLevel(body.beachCondition) : undefined;
  if (body.beachCondition !== undefined && !beachCondition) {
    return res.status(400).json({ ok: false, error: "invalid_beach_condition" });
  }

  const hasJellyfish = parseOptionalBoolean(body.hasJellyfish);
  if (hasJellyfish === null) {
    return res.status(400).json({ ok: false, error: "invalid_has_jellyfish" });
  }

  const hasAlgae = parseOptionalBoolean(body.hasAlgae);
  if (hasAlgae === null) {
    return res.status(400).json({ ok: false, error: "invalid_has_algae" });
  }

  const reporterHashRaw = toSingleString(body.reporterHash);
  if (reporterHashRaw && reporterHashRaw.length > MAX_REPORTER_HASH_LENGTH) {
    return res.status(400).json({ ok: false, error: "invalid_reporter_hash" });
  }

  const attribution = mergeAttributionFlags(
    sanitizeAttribution(body.attribution),
    hasJellyfish,
    hasAlgae,
  );
  const nowIso = new Date().toISOString();
  const rateSinceIso = new Date(
    Date.now() - REPORT_RATE_LIMIT_MIN * 60 * 1000,
  ).toISOString();

  if (TEST_MODE) {
    const result = updateTestModeStore(
      REPORTS_TEST_STORE_FILE,
      createReportsTestStore,
      (state) => {
        const duplicate = state.reports.find(
          (report) =>
            report.beach_id === beachId &&
            report.reporter_hash === reporterHash &&
            report.created_at >= rateSinceIso,
        );
        if (duplicate) {
          return { duplicate: true as const, row: null as ReportRow | null };
        }

        const id = randomUUID();
        const row: ReportRow = {
          id,
          beach_id: beachId,
          crowd_level: crowdLevel,
          water_condition: waterCondition ?? null,
          beach_condition: beachCondition ?? null,
          created_at: nowIso,
          attribution,
          reporter_hash: reporterHash,
        };

        state.reports.unshift(row);
        if (state.reports.length > TEST_MODE_MAX_REPORTS) {
          state.reports.length = TEST_MODE_MAX_REPORTS;
        }

        return { duplicate: false as const, row };
      },
    );

    if (result.duplicate) {
      return sendTooSoon(res);
    }

    const row = result.row;
    if (!row) {
      return res.status(500).json({ ok: false, error: "report_invalid" });
    }
    const publicReport = toPublicReport(row);
    if (!publicReport) {
      return res.status(500).json({ ok: false, error: "report_invalid" });
    }
    const rewards: ReportRewardSummary = {
      awardedPoints: REPORT_COMPLETED_POINTS,
      pointsBalance: null,
    };
    return res.status(200).json({ ok: true, report: publicReport, rewards });
  }

  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const { data: recentRows, error: rateError } = await supabase
    .from(REPORTS_TABLE)
    .select("id, created_at")
    .eq("beach_id", beachId)
    .eq("reporter_hash", reporterHash)
    .gte("created_at", rateSinceIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (rateError) {
    return res.status(500).json({ ok: false, error: "db_rate_check_failed" });
  }

  if (Array.isArray(recentRows) && recentRows.length > 0) {
    return sendTooSoon(res);
  }

  const ipHash = anonymizeHeaderValue(getClientIp(req), "ip");
  const userAgentHash = anonymizeHeaderValue(
    toSingleString(req.headers["user-agent"]),
    "ua",
  );

  const insertPayload = {
    beach_id: beachId,
    crowd_level: crowdLevel,
    water_condition: waterCondition ?? null,
    beach_condition: beachCondition ?? null,
    reporter_hash: reporterHash,
    user_id: reporterUserId,
    attribution,
    source_ip: ipHash,
    user_agent: userAgentHash,
    created_at: nowIso,
  };

  const { data: inserted, error: insertError } = await supabase
    .from(REPORTS_TABLE)
    .insert(insertPayload)
    .select("id, beach_id, crowd_level, water_condition, beach_condition, created_at, attribution")
    .single();

  if (insertError) {
    return res.status(500).json({ ok: false, error: "db_insert_failed" });
  }

  const row = toReportRow(inserted);
  const report = row ? toPublicReport(row) : null;
  if (!report) {
    return res.status(500).json({ ok: false, error: "report_invalid" });
  }
  let pointsBalance: number | null = null;
  if (reporterUserId) {
    const { data: rewardRow } = await supabase
      .from("user_points_balances")
      .select("points_balance")
      .eq("user_id", reporterUserId)
      .maybeSingle();
    if (rewardRow && typeof rewardRow.points_balance === "number") {
      pointsBalance = rewardRow.points_balance;
    }
  }

  const rewards: ReportRewardSummary = {
    awardedPoints: REPORT_COMPLETED_POINTS,
    pointsBalance,
  };

  return res.status(200).json({ ok: true, report, rewards });
}
