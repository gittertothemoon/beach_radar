import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readEnv } from "../_lib/security.js";
import { updateTestModeStore } from "./test-mode-store.js";

type RateEntry = {
  count: number;
  resetAt: number;
};

type BusinessRequestBody = {
  businessType: string;
  companyName: string;
  contactName: string;
  role: string;
  email: string;
  phone: string | null;
  city: string;
  message: string | null;
  lang: "it" | "en";
  hp: string | null;
  utm: Record<string, unknown>;
  attribution: Record<string, unknown>;
};

type BusinessRequestTestState = {
  leads: Record<string, { firstSeenMs: number; lastSeenMs: number; count: number }>;
  rateLimits: Record<string, RateEntry>;
};

const MAX_BODY_BYTES = 24 * 1024;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 8;
const DEDUP_WINDOW_DAYS = 30;
const EMAIL_DOMAIN_CHECK_TIMEOUT_MS = 2200;
const EMAIL_DOMAIN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const rateLimits = new Map<string, RateEntry>();
const emailDomainValidationCache = new Map<
  string,
  { ok: boolean; checkedAt: number }
>();
const BUSINESS_REQUEST_TEST_STORE_FILE = "business-requests-state.json";
const TEST_MODE =
  process.env.BUSINESS_REQUEST_TEST_MODE === "1" ||
  process.env.SIGNUP_TEST_MODE === "1" ||
  process.env.WAITLIST_TEST_MODE === "1";
const ALLOWED_BUSINESS_TYPES = new Set([
  "stabilimento",
  "comune",
  "tour_operator",
  "hotel",
  "agency",
  "other",
]);
const RESERVED_EMAIL_DOMAIN_SUFFIXES = [
  ".example",
  ".invalid",
  ".localhost",
  ".local",
  ".test",
];
const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
]);

const readIntEnv = (name: string, fallback: number, min: number, max: number): number => {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toSingleString = (value: unknown): string | null => {
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
};

const sanitizeText = (value: unknown, maxLen: number): string | null => {
  const raw = toSingleString(value);
  if (!raw) return null;
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLen);
};

const normalizeValue = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sanitizeObject = (
  value: unknown,
  options: { maxKeys: number; maxValLen: number },
): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, options.maxKeys);
  for (const [key, rawVal] of entries) {
    const safeKey = sanitizeText(key, 40);
    if (!safeKey) continue;
    if (typeof rawVal === "string") {
      out[safeKey] = rawVal.trim().slice(0, options.maxValLen);
      continue;
    }
    if (typeof rawVal === "number" || typeof rawVal === "boolean") {
      out[safeKey] = rawVal;
      continue;
    }
    if (rawVal === null) {
      out[safeKey] = null;
    }
  }
  return out;
};

const createBusinessTestState = (): BusinessRequestTestState => ({
  leads: {},
  rateLimits: {},
});

const emailLooksValid = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const phoneLooksValid = (phone: string): boolean =>
  /^[+0-9()\-.\s]{6,32}$/.test(phone);

const getEmailDomain = (email: string): string | null => {
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator >= email.length - 1) return null;
  return email.slice(separator + 1).toLowerCase();
};

const isReservedEmailDomain = (domain: string): boolean =>
  RESERVED_EMAIL_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix));

const getCachedDomainValidation = (domain: string): boolean | null => {
  const cached = emailDomainValidationCache.get(domain);
  if (!cached) return null;
  if (Date.now() - cached.checkedAt > EMAIL_DOMAIN_CACHE_TTL_MS) {
    emailDomainValidationCache.delete(domain);
    return null;
  }
  return cached.ok;
};

const setCachedDomainValidation = (domain: string, ok: boolean): void => {
  emailDomainValidationCache.set(domain, { ok, checkedAt: Date.now() });
};

const withTimeout = async <T>(task: Promise<T>, timeoutMs: number): Promise<T> =>
  await Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("dns_timeout")), timeoutMs);
    }),
  ]);

const classifyDnsError = (error: unknown): "not_found" | "unknown" => {
  if (!error || typeof error !== "object") return "unknown";
  const maybe = error as { code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  if (code === "ENOTFOUND" || code === "ENODATA") return "not_found";
  return "unknown";
};

const hasAnyDnsRecord = async (domain: string): Promise<boolean | null> => {
  const cached = getCachedDomainValidation(domain);
  if (cached !== null) return cached;

  let mxStatus: "found" | "not_found" | "unknown" = "unknown";
  try {
    const mxRecords = await withTimeout(dns.resolveMx(domain), EMAIL_DOMAIN_CHECK_TIMEOUT_MS);
    mxStatus = mxRecords.length > 0 ? "found" : "not_found";
  } catch (error) {
    mxStatus = classifyDnsError(error);
  }
  if (mxStatus === "found") {
    setCachedDomainValidation(domain, true);
    return true;
  }

  let addressStatus: "found" | "not_found" | "unknown" = "unknown";
  try {
    const [v4, v6] = await withTimeout(
      Promise.allSettled([dns.resolve4(domain), dns.resolve6(domain)]),
      EMAIL_DOMAIN_CHECK_TIMEOUT_MS,
    );
    const hasV4 = v4.status === "fulfilled" && v4.value.length > 0;
    const hasV6 = v6.status === "fulfilled" && v6.value.length > 0;
    if (hasV4 || hasV6) {
      addressStatus = "found";
    } else {
      const v4NotFound = v4.status === "rejected" && classifyDnsError(v4.reason) === "not_found";
      const v6NotFound = v6.status === "rejected" && classifyDnsError(v6.reason) === "not_found";
      addressStatus = v4NotFound && v6NotFound ? "not_found" : "unknown";
    }
  } catch {
    addressStatus = "unknown";
  }

  if (addressStatus === "found") {
    setCachedDomainValidation(domain, true);
    return true;
  }
  if (mxStatus === "not_found" && addressStatus === "not_found") {
    setCachedDomainValidation(domain, false);
    return false;
  }
  return null;
};

const validateEmailQuality = async (
  email: string,
  options: { testMode: boolean },
): Promise<{ ok: true } | { ok: false; error: "invalid_email_domain" | "disposable_email_domain" }> => {
  const domain = getEmailDomain(email);
  if (!domain || domain.length < 4 || !domain.includes(".")) {
    return { ok: false, error: "invalid_email_domain" };
  }

  if (isReservedEmailDomain(domain)) {
    return { ok: false, error: "invalid_email_domain" };
  }
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, error: "disposable_email_domain" };
  }

  // Keep tests deterministic and fast; in real traffic, enforce DNS-backed validation.
  if (options.testMode) return { ok: true };

  const hasDns = await hasAnyDnsRecord(domain);
  if (hasDns === false) {
    return { ok: false, error: "invalid_email_domain" };
  }
  return { ok: true };
};

const readBody = (
  req: VercelRequest,
): { body: Record<string, unknown> | null; error?: string } => {
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
      return isRecord(parsed)
        ? { body: parsed }
        : { body: null, error: "invalid_body" };
    } catch {
      return { body: null, error: "invalid_json" };
    }
  }

  if (!isRecord(req.body)) {
    return { body: null, error: "invalid_body" };
  }

  try {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
  } catch {
    return { body: null, error: "invalid_body" };
  }

  return { body: req.body };
};

const parseBusinessType = (value: unknown): string | null => {
  const parsed = sanitizeText(value, 32)?.toLowerCase() || null;
  if (!parsed) return null;
  return ALLOWED_BUSINESS_TYPES.has(parsed) ? parsed : null;
};

const parseLanguage = (value: unknown): "it" | "en" => {
  const parsed = sanitizeText(value, 12)?.toLowerCase() || "it";
  return parsed === "en" ? "en" : "it";
};

const parsePayload = (
  body: Record<string, unknown>,
): { ok: true; payload: BusinessRequestBody } | { ok: false; error: string } => {
  const businessType = parseBusinessType(body.businessType);
  if (!businessType) return { ok: false, error: "invalid_business_type" };

  const companyName = sanitizeText(body.companyName, 120);
  if (!companyName || companyName.length < 2) {
    return { ok: false, error: "invalid_company_name" };
  }

  const contactName = sanitizeText(body.contactName, 120);
  if (!contactName || contactName.length < 2) {
    return { ok: false, error: "invalid_contact_name" };
  }

  const role = sanitizeText(body.role, 80);
  if (!role || role.length < 2) return { ok: false, error: "invalid_role" };

  const email = sanitizeText(body.email, 180)?.toLowerCase() || null;
  if (!email || !emailLooksValid(email)) return { ok: false, error: "invalid_email" };

  const city = sanitizeText(body.city, 80);
  if (!city || city.length < 2) return { ok: false, error: "invalid_city" };

  const phone = sanitizeText(body.phone, 32);
  if (phone && !phoneLooksValid(phone)) return { ok: false, error: "invalid_phone" };

  const message = sanitizeText(body.message, 1200);
  const hp = sanitizeText(body.hp ?? body.company, 120);
  const lang = parseLanguage(body.lang);
  const utm = sanitizeObject(body.utm, { maxKeys: 16, maxValLen: 120 });
  const attribution = sanitizeObject(body.attribution, { maxKeys: 16, maxValLen: 120 });

  return {
    ok: true,
    payload: {
      businessType,
      companyName,
      contactName,
      role,
      email,
      phone,
      city,
      message,
      lang,
      hp,
      utm,
      attribution,
    },
  };
};

const getClientIp = (req: VercelRequest): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() || null;
  }
  const remote = req.socket?.remoteAddress;
  return typeof remote === "string" ? remote : null;
};

const hashValue = (value: string, namespace: "ip" | "ua"): string => {
  const salt = readEnv("SIGNUP_HASH_SALT");
  const payload = salt ? `${namespace}:${salt}:${value}` : `${namespace}:${value}`;
  return createHash("sha256").update(payload).digest("hex");
};

const anonymizeSource = (value: string | null, namespace: "ip" | "ua"): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `sha256:${hashValue(trimmed, namespace)}`;
};

const isTestModeRequest = (req: VercelRequest): boolean => {
  if (TEST_MODE) return true;
  if (process.env.NODE_ENV === "production") return false;
  return toSingleString(req.headers["x-w2b-test-mode"]) === "1";
};

const checkRateLimit = (
  req: VercelRequest,
  testMode: boolean,
): { ok: boolean; retryAfter?: number } => {
  const now = Date.now();
  const windowSec = readIntEnv(
    "BUSINESS_RATE_LIMIT_WINDOW_SEC",
    DEFAULT_RATE_LIMIT_WINDOW_MS / 1000,
    30,
    3600,
  );
  const windowMs = windowSec * 1000;
  const max = readIntEnv("BUSINESS_RATE_LIMIT_MAX", DEFAULT_RATE_LIMIT_MAX, 1, 80);
  const testOverrideRaw = toSingleString(req.headers["x-w2b-test-rate-max"]);
  const testOverride = testOverrideRaw ? Number.parseInt(testOverrideRaw, 10) : NaN;
  if (testMode && !Number.isFinite(testOverride)) {
    // In test mode, rate limiting is opt-in via x-w2b-test-rate-max so
    // unrelated integration tests are deterministic across repeated runs.
    return { ok: true };
  }
  const effectiveMax =
    testMode && Number.isFinite(testOverride) && testOverride >= 1 && testOverride <= 50
      ? testOverride
      : max;

  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = getClientIp(req) || "unknown";
  const ua = toSingleString(req.headers["user-agent"]) || "unknown";
  const key = `${hashValue(ip, "ip")}:${hashValue(ua, "ua")}:${windowStart}`;

  if (testMode) {
    return updateTestModeStore(
      BUSINESS_REQUEST_TEST_STORE_FILE,
      createBusinessTestState,
      (state) => {
        const rateLimitsState =
          state.rateLimits && typeof state.rateLimits === "object"
            ? state.rateLimits
            : (state.rateLimits = {});
        for (const [rateKey, entry] of Object.entries(rateLimitsState)) {
          if (!entry || entry.resetAt <= now) {
            delete rateLimitsState[rateKey];
          }
        }

        const existingEntry = rateLimitsState[key];
        if (!existingEntry || existingEntry.resetAt <= now) {
          rateLimitsState[key] = {
            count: 1,
            resetAt: windowStart + windowMs,
          };
          return { ok: true };
        }

        if (existingEntry.count >= effectiveMax) {
          return {
            ok: false,
            retryAfter: Math.max(1, Math.ceil((existingEntry.resetAt - now) / 1000)),
          };
        }

        existingEntry.count += 1;
        return { ok: true };
      },
    );
  }

  const existing = rateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: windowStart + windowMs });
    return { ok: true };
  }

  if (existing.count >= effectiveMax) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
};

const sendLeadNotification = async (input: {
  to: string;
  from: string;
  replyTo?: string | null;
  payload: BusinessRequestBody;
}): Promise<{ ok: boolean; error?: string }> => {
  const resendApiKey = readEnv("RESEND_API_KEY");
  if (!resendApiKey) return { ok: false, error: "missing_resend_api_key" };

  const html = `
    <h2>Nuova richiesta partnership Where2Beach</h2>
    <p><strong>Azienda:</strong> ${input.payload.companyName}</p>
    <p><strong>Tipo:</strong> ${input.payload.businessType}</p>
    <p><strong>Contatto:</strong> ${input.payload.contactName}</p>
    <p><strong>Ruolo:</strong> ${input.payload.role}</p>
    <p><strong>Email:</strong> ${input.payload.email}</p>
    <p><strong>Telefono:</strong> ${input.payload.phone || "n/d"}</p>
    <p><strong>Città:</strong> ${input.payload.city}</p>
    <p><strong>Lingua:</strong> ${input.payload.lang}</p>
    <p><strong>Messaggio:</strong> ${input.payload.message || "n/d"}</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        reply_to: input.replyTo || undefined,
        subject: `Nuova richiesta business: ${input.payload.companyName}`,
        html,
      }),
    });

    if (!response.ok) return { ok: false, error: "notify_send_failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "notify_network_failed" };
  }
};

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return code === "PGRST205" || /could not find the table/i.test(message);
};

const notifyLeadWithoutStorage = async (
  payload: BusinessRequestBody,
): Promise<{ notified: boolean }> => {
  const notifyFrom =
    readEnv("BUSINESS_FROM") || readEnv("SIGNUP_FROM") || readEnv("WAITLIST_FROM");
  if (!notifyFrom) return { notified: false };

  const notifyTo = readEnv("BUSINESS_LEADS_NOTIFY_TO") || "info@where2beach.com";
  const notifyReplyTo = readEnv("BUSINESS_REPLY_TO") || payload.email;
  const notification = await sendLeadNotification({
    to: notifyTo,
    from: notifyFrom,
    replyTo: notifyReplyTo,
    payload,
  });
  return { notified: notification.ok };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const testMode = isTestModeRequest(req);
  const rate = checkRateLimit(req, testMode);
  if (!rate.ok) {
    if (rate.retryAfter) {
      res.setHeader("Retry-After", String(rate.retryAfter));
    }
    return res.status(429).json({
      ok: false,
      error: "rate_limited",
      retry_after: rate.retryAfter,
    });
  }

  const { body, error: bodyError } = readBody(req);
  if (bodyError) {
    const status = bodyError === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error: bodyError });
  }
  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const parsed = parsePayload(body);
  if (parsed.ok === false) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  const payload = parsed.payload;

  if (payload.hp) {
    return res.status(200).json({ ok: true, already: false, notified: false });
  }

  const emailQuality = await validateEmailQuality(payload.email, { testMode });
  if (emailQuality.ok === false) {
    return res.status(400).json({ ok: false, error: emailQuality.error });
  }

  const companyNameNorm = normalizeValue(payload.companyName);
  const emailNorm = payload.email.toLowerCase();
  const dedupWindowMs = DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const dedupSinceIso = new Date(nowMs - dedupWindowMs).toISOString();
  const sourceIp = anonymizeSource(getClientIp(req), "ip");
  const userAgent = anonymizeSource(toSingleString(req.headers["user-agent"]), "ua");
  const nowIso = new Date(nowMs).toISOString();

  if (testMode) {
    const key = `${emailNorm}:${companyNameNorm}`;
    const outcome = updateTestModeStore(
      BUSINESS_REQUEST_TEST_STORE_FILE,
      createBusinessTestState,
      (state) => {
        const leadsState =
          state.leads && typeof state.leads === "object"
            ? state.leads
            : (state.leads = {});
        const existing = leadsState[key];
        if (existing && nowMs - existing.firstSeenMs <= dedupWindowMs) {
          existing.count += 1;
          existing.lastSeenMs = nowMs;
          return { already: true };
        }
        leadsState[key] = {
          firstSeenMs: nowMs,
          lastSeenMs: nowMs,
          count: 1,
        };
        return { already: false };
      },
    );
    return res.status(200).json({
      ok: true,
      already: outcome.already,
      notified: true,
    });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const table = readEnv("BUSINESS_REQUEST_TABLE") || "business_requests";
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id, count, notified")
    .eq("email_norm", emailNorm)
    .eq("company_name_norm", companyNameNorm)
    .gte("first_seen_at", dedupSinceIso)
    .order("first_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    if (isMissingTableError(existingError)) {
      const fallback = await notifyLeadWithoutStorage(payload);
      return res.status(200).json({
        ok: true,
        already: false,
        notified: fallback.notified,
      });
    }
    return res.status(500).json({ ok: false, error: "db_select_failed" });
  }

  if (existing?.id) {
    const nextCount =
      typeof existing.count === "number" && Number.isFinite(existing.count)
        ? existing.count + 1
        : 2;
    await supabase
      .from(table)
      .update({
        last_seen_at: nowIso,
        updated_at: nowIso,
        count: nextCount,
      })
      .eq("id", existing.id);

    return res.status(200).json({
      ok: true,
      already: true,
      notified: existing.notified === true,
    });
  }

  const insertPayload = {
    business_type: payload.businessType,
    company_name: payload.companyName,
    company_name_norm: companyNameNorm,
    contact_name: payload.contactName,
    role: payload.role,
    email: payload.email,
    email_norm: emailNorm,
    phone: payload.phone,
    city: payload.city,
    message: payload.message,
    lang: payload.lang,
    utm: payload.utm,
    attribution: payload.attribution,
    meta: sanitizeObject(body.meta, { maxKeys: 20, maxValLen: 160 }),
    source_ip: sourceIp,
    user_agent: userAgent,
    honeypot: null,
    status: "new",
    notified: false,
    notification_error: null,
    count: 1,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: created, error: insertError } = await supabase
    .from(table)
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !created?.id) {
    return res.status(500).json({ ok: false, error: "db_insert_failed" });
  }

  const notifyTo = readEnv("BUSINESS_LEADS_NOTIFY_TO") || "info@where2beach.com";
  const notifyFrom =
    readEnv("BUSINESS_FROM") || readEnv("SIGNUP_FROM") || readEnv("WAITLIST_FROM");
  const notifyReplyTo = readEnv("BUSINESS_REPLY_TO") || payload.email;

  if (!notifyFrom) {
    await supabase
      .from(table)
      .update({
        notification_error: "missing_notify_from",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    return res.status(200).json({ ok: true, already: false, notified: false });
  }

  const notification = await sendLeadNotification({
    to: notifyTo,
    from: notifyFrom,
    replyTo: notifyReplyTo,
    payload,
  });

  if (!notification.ok) {
    await supabase
      .from(table)
      .update({
        notified: false,
        notification_error: notification.error || "notify_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    return res.status(200).json({ ok: true, already: false, notified: false });
  }

  await supabase
    .from(table)
    .update({
      notified: true,
      notification_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", created.id);

  return res.status(200).json({ ok: true, already: false, notified: true });
}
