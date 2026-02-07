import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPORTS_TABLE = "beach_reports";
const MAX_BODY_BYTES = 8 * 1024;
const REPORT_RATE_LIMIT_MIN = 10;
const REPORTS_LOOKBACK_HOURS = 6;
const MAX_BEACH_ID_LENGTH = 96;
const MAX_REPORTER_HASH_LENGTH = 128;
const TEST_MODE = process.env.REPORTS_TEST_MODE === "1";

type ReportRow = {
  id: string;
  beach_id: string;
  crowd_level: number;
  created_at: string;
  attribution: unknown;
  reporter_hash?: string;
};

type PublicReport = {
  id: string;
  beachId: string;
  crowdLevel: 1 | 2 | 3 | 4;
  createdAt: number;
  attribution?: unknown;
};

const testReports: ReportRow[] = [];

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

function toReportRow(value: unknown): ReportRow | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : null;
  const beachId = typeof value.beach_id === "string" ? value.beach_id : null;
  const crowdLevel =
    typeof value.crowd_level === "number" ? value.crowd_level : null;
  const createdAt = typeof value.created_at === "string" ? value.created_at : null;
  if (!id || !beachId || !crowdLevel || !createdAt) return null;
  return {
    id,
    beach_id: beachId,
    crowd_level: crowdLevel,
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
  return {
    id: row.id,
    beachId: row.beach_id,
    crowdLevel,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const lookbackIso = getLookbackIso();

    if (TEST_MODE) {
      const reports = testReports
        .filter((report) => report.created_at >= lookbackIso)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((row) => toPublicReport(row))
        .filter((row): row is PublicReport => row !== null);

      res.setHeader(
        "Cache-Control",
        "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
      );
      return res.status(200).json({ ok: true, reports });
    }

    const supabase = buildSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }

    const { data, error } = await supabase
      .from(REPORTS_TABLE)
      .select("id, beach_id, crowd_level, created_at, attribution")
      .gte("created_at", lookbackIso)
      .order("created_at", { ascending: false })
      .limit(5000);

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
      "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
    );
    return res.status(200).json({ ok: true, reports });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
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

  const reporterHash = toSingleString(body.reporterHash);
  if (!reporterHash || reporterHash.length > MAX_REPORTER_HASH_LENGTH) {
    return res.status(400).json({ ok: false, error: "invalid_reporter_hash" });
  }

  const attribution = sanitizeAttribution(body.attribution);
  const nowIso = new Date().toISOString();
  const rateSinceIso = new Date(
    Date.now() - REPORT_RATE_LIMIT_MIN * 60 * 1000,
  ).toISOString();

  if (TEST_MODE) {
    const duplicate = testReports.find(
      (report) =>
        report.beach_id === beachId &&
        report.reporter_hash === reporterHash &&
        report.created_at >= rateSinceIso,
    );
    if (duplicate) {
      return res.status(429).json({
        ok: false,
        error: "too_soon",
        retry_after: getRateRetryAfterSec(),
      });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const row: ReportRow = {
      id,
      beach_id: beachId,
      crowd_level: crowdLevel,
      created_at: nowIso,
      attribution,
      reporter_hash: reporterHash,
    };
    testReports.unshift(row);
    const publicReport = toPublicReport(row);
    if (!publicReport) {
      return res.status(500).json({ ok: false, error: "report_invalid" });
    }
    return res.status(200).json({ ok: true, report: publicReport });
  }

  const supabase = buildSupabaseClient();
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
    return res.status(429).json({
      ok: false,
      error: "too_soon",
      retry_after: getRateRetryAfterSec(),
    });
  }

  const ip = getClientIp(req);
  const userAgent =
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : null;

  const insertPayload = {
    beach_id: beachId,
    crowd_level: crowdLevel,
    reporter_hash: reporterHash,
    attribution,
    source_ip: ip,
    user_agent: userAgent,
    created_at: nowIso,
  };

  const { data: inserted, error: insertError } = await supabase
    .from(REPORTS_TABLE)
    .insert(insertPayload)
    .select("id, beach_id, crowd_level, created_at, attribution")
    .single();

  if (insertError) {
    return res.status(500).json({ ok: false, error: "db_insert_failed" });
  }

  const row = toReportRow(inserted);
  const report = row ? toPublicReport(row) : null;
  if (!report) {
    return res.status(500).json({ ok: false, error: "report_invalid" });
  }

  return res.status(200).json({ ok: true, report });
}
