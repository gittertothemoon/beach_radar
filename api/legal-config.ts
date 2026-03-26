import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readEnv } from "./_lib/security.js";

type LegalConfig = {
  privacyUrl: string;
  termsUrl: string;
  cookieUrl: string;
  contactEmail: string;
  iubenda: {
    siteId: number | null;
    cookiePolicyId: number | null;
    lang: string;
    autoBlocking: boolean;
  };
};

const DEFAULT_CONFIG: LegalConfig = {
  privacyUrl: "/privacy/",
  termsUrl: "/terms/",
  cookieUrl: "/cookie-policy/",
  contactEmail: "privacy@where2beach.com",
  iubenda: {
    siteId: null,
    cookiePolicyId: null,
    lang: "it",
    autoBlocking: true,
  },
};

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function readPositiveIntEnv(name: string): number | null {
  const raw = readEnv(name);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function readFirst(...names: string[]): string | null {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return null;
}

function sanitizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    try {
      const parsed = new URL(trimmed, "https://where2beach.com");
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, "") || ""}/`;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function resolvePrivacyUrl(): string {
  const explicit = sanitizeUrl(
    readFirst("LEGAL_PRIVACY_URL", "IUBENDA_PRIVACY_URL", "IUBENDA_PRIVACY_POLICY_URL"),
  );
  if (explicit) return explicit;

  const policyId = readPositiveIntEnv("IUBENDA_PRIVACY_POLICY_ID");
  if (policyId) return `https://www.iubenda.com/privacy-policy/${policyId}`;

  return DEFAULT_CONFIG.privacyUrl;
}

function resolveTermsUrl(): string {
  const explicit = sanitizeUrl(readFirst("LEGAL_TERMS_URL", "IUBENDA_TERMS_URL"));
  if (explicit) return explicit;

  const termsId = readPositiveIntEnv("IUBENDA_TERMS_ID");
  if (termsId) return `https://www.iubenda.com/terms-and-conditions/${termsId}`;

  return DEFAULT_CONFIG.termsUrl;
}

function resolveCookieUrl(): string {
  const explicit = sanitizeUrl(readFirst("LEGAL_COOKIE_URL", "IUBENDA_COOKIE_URL"));
  if (explicit) return explicit;

  const cookiePolicyId = readPositiveIntEnv("IUBENDA_COOKIE_POLICY_ID");
  const privacyPolicyId = readPositiveIntEnv("IUBENDA_PRIVACY_POLICY_ID");
  if (privacyPolicyId && cookiePolicyId) {
    return `https://www.iubenda.com/privacy-policy/${privacyPolicyId}/cookie-policy`;
  }

  return DEFAULT_CONFIG.cookieUrl;
}

function buildConfig(): LegalConfig {
  const siteId = readPositiveIntEnv("IUBENDA_SITE_ID");
  const cookiePolicyId = readPositiveIntEnv("IUBENDA_COOKIE_POLICY_ID");

  const lang = readFirst("IUBENDA_LANG", "LEGAL_LANG") ?? DEFAULT_CONFIG.iubenda.lang;

  return {
    privacyUrl: resolvePrivacyUrl(),
    termsUrl: resolveTermsUrl(),
    cookieUrl: resolveCookieUrl(),
    contactEmail:
      sanitizeEmail(readFirst("LEGAL_CONTACT_EMAIL", "PRIVACY_CONTACT_EMAIL")) ??
      DEFAULT_CONFIG.contactEmail,
    iubenda: {
      siteId,
      cookiePolicyId,
      lang,
      autoBlocking: readBooleanEnv("IUBENDA_AUTO_BLOCKING", true),
    },
  };
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  applyApiSecurityHeaders(res, {
    cacheControl: "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const config = buildConfig();
  res.status(200).json({ ok: true, config });
}
