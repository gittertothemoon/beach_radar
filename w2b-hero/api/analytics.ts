import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANALYTICS_TABLE = "analytics_events";
const MAX_BODY_BYTES = 12 * 1024;
const MAX_PROPS_BYTES = 4 * 1024;
const DEFAULT_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAME_RE = /^[a-z][a-z0-9_:-]{1,63}$/i;

type RateEntry = {
  count: number;
  resetAt: number;
};

type JsonSafeValue = string | number | boolean | null | Record<string, unknown> | unknown[];

type SupabaseAuthClient = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id?: string | null } | null };
      error: unknown;
    }>;
  };
};

type AnalyticsInsert = {
  event_name: string;
  session_id: string;
  path: string;
  beach_id: string | null;
  src: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  props: Record<string, unknown> | null;
  event_id: string | null;
  user_id: string | null;
  created_at: string;
};

const rateLimits = new Map<string, RateEntry>();

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
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

function sanitizeText(value: unknown, maxLength: number): string | null {
  const single = toSingleString(value);
  if (!single) return null;
  return single.length <= maxLength ? single : null;
}

function toIsoString(value: unknown): string | null {
  const raw = toSingleString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function sanitizeJsonValue(
  value: unknown,
  depth = 0,
): JsonSafeValue {
  if (depth > 5) return null;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    if (typeof value === "string") return value.slice(0, 500);
    return value as string | number | boolean | null;
  }

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    for (const item of value.slice(0, 40)) {
      const sanitized = sanitizeJsonValue(item, depth + 1);
      if (sanitized !== null) next.push(sanitized);
    }
    return next;
  }

  if (!isObject(value)) return null;

  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key.length === 0 || key.length > 100) continue;
    const lowered = key.toLowerCase();
    if (lowered.includes("email") || lowered.includes("ip") || lowered.includes("useragent")) {
      continue;
    }
    const sanitized = sanitizeJsonValue(raw, depth + 1);
    if (sanitized !== null) {
      next[key] = sanitized;
    }
  }
  return next;
}

function parseProps(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null;
  const sanitized = sanitizeJsonValue(value);
  if (!isObject(sanitized)) return null;
  try {
    const serialized = JSON.stringify(sanitized);
    if (serialized.length > MAX_PROPS_BYTES) {
      return null;
    }
  } catch {
    return null;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function readBody(req: VercelRequest): {
  body: Record<string, unknown> | null;
  error?: string;
} {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
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
    if (JSON.stringify(req.body).length > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
  } catch {
    return { body: null, error: "invalid_body" };
  }

  return { body: req.body };
}

function getClientIp(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() || null;
  }
  const remote = req.socket?.remoteAddress;
  return typeof remote === "string" ? remote : null;
}

function anonymize(value: string | null, namespace: "ip" | "ua"): string {
  const salt = readEnv("ANALYTICS_SALT");
  const raw = value?.trim() || "unknown";
  const payload = salt
    ? `${namespace}:${salt}:${raw}`
    : `${namespace}:${raw}`;
  return createHash("sha256").update(payload).digest("hex");
}

function checkRateLimit(req: VercelRequest): { ok: boolean; retryAfter?: number } {
  const limit = readIntEnv("ANALYTICS_RATE_LIMIT", DEFAULT_RATE_LIMIT, 5, 1000);
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const ipHash = anonymize(getClientIp(req), "ip");
  const uaHash = anonymize(toSingleString(req.headers["user-agent"]), "ua");
  const key = `${ipHash}:${uaHash}:${windowStart}`;
  const existing = rateLimits.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: windowStart + RATE_WINDOW_MS });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true };
}

function buildSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

function parseAnalyticsPayload(body: Record<string, unknown>): AnalyticsInsert | null {
  const eventName = sanitizeText(body.eventName, 64);
  if (!eventName || !EVENT_NAME_RE.test(eventName)) return null;

  const ts = toIsoString(body.ts);
  if (!ts) return null;

  const sessionId = sanitizeText(body.sessionId, 128);
  if (!sessionId || sessionId.length < 8) return null;

  const path = sanitizeText(body.path, 2048);
  if (!path || !path.startsWith("/")) return null;

  const eventId = sanitizeText(body.eventId, 36);
  if (eventId && !UUID_RE.test(eventId)) return null;

  return {
    event_name: eventName,
    created_at: ts,
    session_id: sessionId,
    path,
    beach_id: sanitizeText(body.beachId, 96),
    src: sanitizeText(body.src, 96),
    utm_source: sanitizeText(body.utm_source, 120),
    utm_medium: sanitizeText(body.utm_medium, 120),
    utm_campaign: sanitizeText(body.utm_campaign, 160),
    utm_content: sanitizeText(body.utm_content, 160),
    utm_term: sanitizeText(body.utm_term, 160),
    props: parseProps(body.props),
    event_id: eventId ?? null,
    user_id: null,
  };
}

async function resolveUserId(
  req: VercelRequest,
  supabase: SupabaseAuthClient,
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return UUID_RE.test(data.user.id) ? data.user.id : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const rate = checkRateLimit(req);
  if (!rate.ok) {
    if (rate.retryAfter) {
      res.setHeader("Retry-After", String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  const { body, error: bodyError } = readBody(req);
  if (bodyError) {
    const status = bodyError === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error: bodyError });
  }
  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const parsed = parseAnalyticsPayload(body);
  if (!parsed) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  const supabase = buildSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const userId = await resolveUserId(req, supabase);
  const insertPayload = {
    ...parsed,
    user_id: userId,
  };

  const result = parsed.event_id
    ? await supabase.from(ANALYTICS_TABLE).upsert(insertPayload, {
        onConflict: "event_id",
        ignoreDuplicates: true,
      })
    : await supabase.from(ANALYTICS_TABLE).insert(insertPayload);

  if (result.error) {
    return res.status(500).json({ ok: false, error: "db_insert_failed" });
  }

  return res.status(200).json({ ok: true });
}
