import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, randomBytes } from "node:crypto";

/*
SQL migration snippet (Phase 1):
alter table public.waitlist_signups
  add column if not exists status text not null default 'pending',
  add column if not exists count int not null default 1,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists source_quality text,
  add column if not exists honeypot text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_token_hash text;

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups(created_at);

create index if not exists waitlist_signups_source_quality_idx
  on public.waitlist_signups(source_quality);
*/

type RateEntry = {
  count: number;
  resetAt: number;
};

type RateResult = {
  ok: boolean;
  retryAfter?: number;
};

type RateLimitConfig = {
  windowMs: number;
  max: number;
};

const MAX_BODY_BYTES = 10 * 1024;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 10;
const TEST_MODE = process.env.WAITLIST_TEST_MODE === "1";
const DOUBLE_OPT_IN_ENABLED = process.env.ENABLE_DOUBLE_OPTIN === "1";

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

const testRateLimits = new Map<string, RateEntry>();
const testSignups = new Map<string, { count: number }>();

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

function getRateLimitConfig(): RateLimitConfig {
  const max = Number(readEnv("TEST_RATE_LIMIT") || readEnv("WAITLIST_RATE_LIMIT_MAX") || DEFAULT_RATE_LIMIT_MAX);
  const windowSec = Number(readEnv("WAITLIST_RATE_LIMIT_WINDOW_SEC"));
  const windowMs = Number.isFinite(windowSec) && windowSec > 0
    ? windowSec * 1000
    : DEFAULT_RATE_LIMIT_WINDOW_MS;
  return { max, windowMs };
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getWindowStartMs(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

function getRateLimitKey(ipHash: string, uaHash: string, windowStartMs: number): string {
  return `${ipHash}:${uaHash}:${windowStartMs}`;
}

function checkRateLimitMemory(ip: string | null, userAgent: string | null, config: RateLimitConfig): RateResult {
  const now = Date.now();
  const ipHash = hashValue(ip || "unknown");
  const uaHash = hashValue(userAgent || "unknown");
  const windowStartMs = getWindowStartMs(now, config.windowMs);
  const key = getRateLimitKey(ipHash, uaHash, windowStartMs);
  const entry = testRateLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    testRateLimits.set(key, { count: 1, resetAt: windowStartMs + config.windowMs });
    return { ok: true };
  }

  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  entry.count += 1;
  return { ok: true };
}

async function checkRateLimitDb(
  supabase: ReturnType<typeof createClient>,
  ip: string | null,
  userAgent: string | null,
  config: RateLimitConfig
): Promise<RateResult> {
  const nowMs = Date.now();
  const ipHash = hashValue(ip || "unknown");
  const uaHash = hashValue(userAgent || "unknown");
  const windowStartMs = getWindowStartMs(nowMs, config.windowMs);
  const windowStartIso = new Date(windowStartMs).toISOString();

  const { data, error } = await supabase.rpc("waitlist_rate_limit_touch", {
    ip_hash: ipHash,
    ua_hash: uaHash,
    window_start: windowStartIso
  });

  if (error) {
    return { ok: true };
  }

  const count = Array.isArray(data) ? data[0]?.count : data?.count;
  if (typeof count === "number" && count > config.max) {
    const retryAfter = Math.ceil((windowStartMs + config.windowMs - nowMs) / 1000);
    return { ok: false, retryAfter };
  }

  return { ok: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBody(req: VercelRequest): { body: Record<string, unknown> | null; error?: string } {
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
      return {
        body: isPlainObject(parsed) ? parsed : null,
        error: isPlainObject(parsed) ? undefined : "invalid_body"
      };
    } catch (_) {
      return { body: null, error: "invalid_json" };
    }
  }

  if (isPlainObject(req.body)) {
    try {
      const size = JSON.stringify(req.body).length;
      if (size > MAX_BODY_BYTES) {
        return { body: null, error: "payload_too_large" };
      }
    } catch (_) {
      return { body: null, error: "invalid_body" };
    }

    return { body: req.body };
  }

  return { body: null, error: "invalid_body" };
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function deriveSourceQuality(input: { utmMedium?: string | null; utmSource?: string | null; poster?: string | null }): string {
  const medium = (input.utmMedium || "").toLowerCase();
  const source = (input.utmSource || "").toLowerCase();
  const poster = input.poster ? input.poster.trim() : "";

  if (medium === "qr" || poster) return "high";
  if (source === "instagram" || source === "tiktok") return "mid";
  return "low";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function withDebug(error: { message?: string; code?: string | null; details?: string | null; hint?: string | null }) {
  if (process.env.WAITLIST_DEBUG !== "1") return undefined;
  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
  };
}

function buildConfirmUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendConfirmEmail(options: {
  to: string;
  token: string;
  apiKey: string;
  from: string;
  confirmUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const url = buildConfirmUrl(options.confirmUrl, options.token);

  const payload = {
    from: options.from,
    to: options.to,
    subject: "Confirm your Beach Radar waitlist spot",
    html: `<p>Confirm your email to join the Beach Radar waitlist:</p><p><a href="${url}">Confirm my spot</a></p>`
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return { ok: false, error: "email_send_failed" };
  }

  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { body, error } = readBody(req);
  if (error) {
    const status = error === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error });
  }

  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const honeypot = safeString(body.hp ?? body.company);
  const email = safeString(body.email);
  const emailValid = !!email && emailLooksValid(email);

  if (!honeypot && !emailValid) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  if (honeypot && !emailValid) {
    return res.status(200).json({ ok: true, spam: true });
  }

  const emailValue = email || "";
  const ip = getClientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const rateConfig = getRateLimitConfig();

  if (TEST_MODE) {
    const rateResult = checkRateLimitMemory(ip, userAgent, rateConfig);
    if (!rateResult.ok) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        retry_after: rateResult.retryAfter
      });
    }

    if (honeypot) {
      return res.status(200).json({ ok: true, spam: true });
    }

    const normalizedEmail = emailValue.trim().toLowerCase();
    const existing = testSignups.get(normalizedEmail);
    if (existing) {
      existing.count += 1;
      return res.status(200).json({ ok: true, already: true });
    }
    testSignups.set(normalizedEmail, { count: 1 });
    return res.status(200).json({ ok: true, already: false });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  if (ip || userAgent) {
    const rateResult = await checkRateLimitDb(supabase, ip, userAgent, rateConfig);
    if (!rateResult.ok) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        retry_after: rateResult.retryAfter
      });
    }
  }

  if (honeypot) {
    return res.status(200).json({ ok: true, spam: true });
  }

  const normalizedEmail = emailValue.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const lang = safeString(body.lang);
  const utm = isPlainObject(body.utm) ? body.utm : {};
  const attribution = isPlainObject(body.attribution) ? body.attribution : {};

  const utmMedium = toSingleString(utm["utm_medium"] ?? attribution["utm_medium"]);
  const utmSource = toSingleString(utm["utm_source"] ?? attribution["utm_source"]);
  const poster = toSingleString(attribution["poster"]);
  const sourceQuality = deriveSourceQuality({ utmMedium, utmSource, poster });

  const meta = {
    page: safeString(body.page),
    referrer: safeString(body.referrer),
    tz: safeString(body.tz),
    device: isPlainObject(body.device) ? body.device : null,
    project: safeString(body.project),
    version: safeString(body.version)
  };

  const { data: existing, error: selectError } = await supabase
    .from("waitlist_signups")
    .select("id, count, status, confirm_token_hash")
    .eq("email_norm", normalizedEmail)
    .maybeSingle();

  if (selectError) {
    return res.status(500).json({
      ok: false,
      error: "db_select_failed",
      debug: withDebug(selectError)
    });
  }

  if (existing) {
    const nextCount = (typeof existing.count === "number" && Number.isFinite(existing.count) ? existing.count : 0) + 1;
    const { error: updateError } = await supabase
      .from("waitlist_signups")
      .update({
        last_seen_at: nowIso,
        count: nextCount,
        lang,
        utm,
        attribution,
        meta,
        user_agent: userAgent,
        source_ip: ip,
        source_quality: sourceQuality,
        honeypot: honeypot || null
      })
      .eq("email_norm", normalizedEmail);

    if (updateError) {
      return res.status(500).json({
        ok: false,
        error: "db_update_failed",
        debug: withDebug(updateError)
      });
    }

    return res.status(200).json({ ok: true, already: true });
  }

  let confirmToken: string | null = null;
  let confirmTokenHash: string | null = null;

  if (DOUBLE_OPT_IN_ENABLED) {
    confirmToken = randomBytes(32).toString("hex");
    confirmTokenHash = hashToken(confirmToken);
  }

  const insertPayload = {
    email: emailValue,
    lang,
    utm,
    attribution,
    meta,
    user_agent: userAgent,
    source_ip: ip,
    source_quality: sourceQuality,
    status: "pending",
    count: 1,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    honeypot: honeypot || null,
    confirm_token_hash: confirmTokenHash
  };

  const { error: insertError } = await supabase.from("waitlist_signups").insert(insertPayload);

  if (insertError) {
    return res.status(500).json({
      ok: false,
      error: "db_insert_failed",
      debug: withDebug(insertError)
    });
  }

  if (DOUBLE_OPT_IN_ENABLED && confirmToken) {
    const resendApiKey = readEnv("RESEND_API_KEY");
    const waitlistFrom = readEnv("WAITLIST_FROM");
    const confirmUrl = readEnv("WAITLIST_CONFIRM_URL");
    if (!resendApiKey || !waitlistFrom || !confirmUrl) {
      return res.status(500).json({ ok: false, error: "missing_email_env" });
    }

    const emailResult = await sendConfirmEmail({
      to: emailValue,
      token: confirmToken,
      apiKey: resendApiKey,
      from: waitlistFrom,
      confirmUrl
    });

    if (!emailResult.ok) {
      return res.status(500).json({ ok: false, error: emailResult.error || "email_send_failed" });
    }
  }

  return res.status(200).json({ ok: true, already: false });
}
