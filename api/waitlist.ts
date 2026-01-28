import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type RateEntry = {
  count: number;
  resetAt: number;
};

type RateResult = {
  ok: boolean;
  retryAfter?: number;
};

const MAX_BODY_BYTES = 10 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 25;

const rateLimiter = new Map<string, RateEntry>();

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

function checkRateLimit(ip: string): RateResult {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  entry.count += 1;
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

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  const email = safeString(body.email);
  if (!email || !emailLooksValid(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const ip = getClientIp(req);
  if (ip) {
    const rateResult = checkRateLimit(ip);
    if (!rateResult.ok) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        retry_after: rateResult.retryAfter
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const normalizedEmail = email.trim().toLowerCase();

  const { data: existing, error: selectError } = await supabase
    .from("waitlist_signups")
    .select("id")
    .eq("email_norm", normalizedEmail)
    .maybeSingle();

  if (selectError) {
    return res.status(500).json({ ok: false, error: "db_select_failed" });
  }

  const lang = safeString(body.lang);
  const utm = isPlainObject(body.utm) ? body.utm : null;
  const attribution = isPlainObject(body.attribution) ? body.attribution : null;

  const meta = {
    page: safeString(body.page),
    referrer: safeString(body.referrer),
    tz: safeString(body.tz),
    device: isPlainObject(body.device) ? body.device : null,
    project: safeString(body.project),
    version: safeString(body.version)
  };

  const upsertPayload = {
    email,
    lang,
    utm,
    attribution,
    meta,
    user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    source_ip: ip
  };

  const { error: upsertError } = await supabase
    .from("waitlist_signups")
    .upsert(upsertPayload, { onConflict: "email_norm" });

  if (upsertError) {
    return res.status(500).json({ ok: false, error: "db_upsert_failed" });
  }

  return res.status(200).json({ ok: true, already: !!existing });
}
