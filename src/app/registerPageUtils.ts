export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
export const NICKNAME_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;
const NON_DELIVERABLE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
]);

export const HAS_UPPERCASE = /[A-Z]/;
export const HAS_LOWERCASE = /[a-z]/;
export const HAS_NUMBER = /\d/;
export const HAS_SYMBOL = /[^A-Za-z0-9]/;
export const MIN_PASSWORD_LENGTH = 10;
export const FORGOT_PASSWORD_FAST_NOTICE_MS = 700;

export const DEFAULT_LEGAL_INTERNAL_PATHS = {
  privacy: "/privacy/",
  cookie: "/cookie-policy/",
} as const;

export type RuntimeLegalConfig = {
  privacyUrl?: string;
  cookieUrl?: string;
};

export type WindowWithLegalConfig = Window & {
  W2B_LEGAL_CONFIG?: RuntimeLegalConfig;
};

export const hasNonDeliverableDomain = (emailValue: string): boolean => {
  const atIndex = emailValue.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const domain = emailValue.slice(atIndex + 1).toLowerCase();
  return NON_DELIVERABLE_EMAIL_DOMAINS.has(domain);
};

export const normalizePathname = (value: string): string =>
  value.replace(/\/+$/, "") || "/";

export const isExternalHref = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
};
