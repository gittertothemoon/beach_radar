import { buildApiUrl } from "../config/env";
import { apiFetchJson } from "./http";

type WaitlistApiPayload = {
  ok: true;
  already?: boolean;
  spam?: boolean;
};

type SubmitWaitlistErrorCode =
  | "invalid_email"
  | "rate_limited"
  | "network"
  | "timeout"
  | "unavailable"
  | "invalid_payload";

export type SubmitWaitlistResult =
  | { ok: true; already: boolean; spam: boolean }
  | { ok: false; code: SubmitWaitlistErrorCode; retryAfterSec?: number };

const emailLooksValid = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const submitWaitlist = async (email: string): Promise<SubmitWaitlistResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!emailLooksValid(normalizedEmail)) {
    return { ok: false, code: "invalid_email" };
  }

  const nowIso = new Date().toISOString();
  const payload = {
    email: normalizedEmail,
    lang: "it",
    page: "mobile-app",
    project: "where2beach-mobile",
    version: "phase2",
    hp: "",
    attribution: {
      v: 1,
      src: "mobile",
      utm_source: "mobile",
      utm_medium: "app",
      utm_campaign: "mobile_phase2",
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    },
  };

  const result = await apiFetchJson<WaitlistApiPayload>(buildApiUrl("/waitlist"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    if (result.status === 429 || result.error === "rate_limited") {
      return {
        ok: false,
        code: "rate_limited",
        retryAfterSec: result.retryAfterSec,
      };
    }

    if (result.error === "invalid_email") {
      return { ok: false, code: "invalid_email" };
    }

    return { ok: false, code: result.code };
  }

  if (!isObject(result.data) || result.data.ok !== true) {
    return { ok: false, code: "invalid_payload" };
  }

  return {
    ok: true,
    already: result.data.already === true,
    spam: result.data.spam === true,
  };
};
