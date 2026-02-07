import type { AttributionSnapshot, CrowdLevel, Report } from "./types";

type ApiErrorPayload = {
  ok: false;
  error?: string;
  retry_after?: number;
};

type FetchReportsSuccessPayload = {
  ok: true;
  reports?: unknown;
};

type SubmitReportSuccessPayload = {
  ok: true;
  report?: unknown;
};

type FetchReportsErrorCode = "network" | "unavailable" | "invalid_payload";
type SubmitReportErrorCode =
  | "network"
  | "too_soon"
  | "unavailable"
  | "invalid_payload";

export type FetchReportsResult =
  | { ok: true; reports: Report[] }
  | { ok: false; code: FetchReportsErrorCode };

export type SubmitReportResult =
  | { ok: true; report: Report }
  | { ok: false; code: SubmitReportErrorCode; retryAfterSec?: number };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isCrowdLevel = (value: number): value is CrowdLevel =>
  value === 1 || value === 2 || value === 3 || value === 4;

const isAttributionSnapshot = (value: unknown): value is AttributionSnapshot => {
  if (!isObject(value)) return false;
  if (value.v !== 1) return false;
  if (typeof value.first_seen_at !== "string") return false;
  if (typeof value.last_seen_at !== "string") return false;
  return true;
};

const parseReport = (value: unknown): Report | null => {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;
  if (typeof value.beachId !== "string" || value.beachId.trim().length === 0) {
    return null;
  }
  const crowdLevel = toFiniteNumber(value.crowdLevel);
  const createdAt = toFiniteNumber(value.createdAt);
  if (crowdLevel === null || createdAt === null || !isCrowdLevel(crowdLevel)) {
    return null;
  }
  return {
    id: value.id,
    beachId: value.beachId,
    crowdLevel,
    createdAt,
    attribution: isAttributionSnapshot(value.attribution)
      ? value.attribution
      : undefined,
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const toApiErrorPayload = (value: unknown): ApiErrorPayload | null => {
  if (!isObject(value) || value.ok !== false) return null;
  return {
    ok: false,
    error: typeof value.error === "string" ? value.error : undefined,
    retry_after:
      typeof value.retry_after === "number" && Number.isFinite(value.retry_after)
        ? value.retry_after
        : undefined,
  };
};

export const fetchSharedReports = async (
  signal?: AbortSignal,
): Promise<FetchReportsResult> => {
  let response: Response;
  try {
    response = await fetch("/api/reports", { method: "GET", signal });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, code: "unavailable" };
  }

  const parsed = payload as FetchReportsSuccessPayload;
  if (!parsed || parsed.ok !== true || !Array.isArray(parsed.reports)) {
    return { ok: false, code: "invalid_payload" };
  }

  const reports = parsed.reports
    .map((item) => parseReport(item))
    .filter((item): item is Report => item !== null);

  return { ok: true, reports };
};

export const submitSharedReport = async (input: {
  beachId: string;
  crowdLevel: CrowdLevel;
  reporterHash: string;
  attribution?: AttributionSnapshot;
}): Promise<SubmitReportResult> => {
  let response: Response;
  try {
    response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const errorPayload = toApiErrorPayload(payload);
    if (response.status === 429 || errorPayload?.error === "too_soon") {
      return {
        ok: false,
        code: "too_soon",
        retryAfterSec: errorPayload?.retry_after,
      };
    }
    if (
      errorPayload?.error === "invalid_body" ||
      errorPayload?.error === "invalid_beach_id" ||
      errorPayload?.error === "invalid_crowd_level" ||
      errorPayload?.error === "invalid_reporter_hash"
    ) {
      return { ok: false, code: "invalid_payload" };
    }
    return { ok: false, code: "unavailable" };
  }

  const parsed = payload as SubmitReportSuccessPayload;
  if (!parsed || parsed.ok !== true) {
    return { ok: false, code: "invalid_payload" };
  }
  const report = parseReport(parsed.report);
  if (!report) {
    return { ok: false, code: "invalid_payload" };
  }
  return { ok: true, report };
};
