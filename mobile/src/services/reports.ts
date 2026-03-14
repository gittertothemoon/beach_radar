import { buildApiUrl } from "../config/env";
import type {
  BeachLevel,
  CrowdLevel,
  MobileReport,
  WaterLevel,
} from "../types/domain";
import { apiFetchJson } from "./http";
import { getReporterHash } from "./reporter";

type ReportsApiPayload = {
  ok: true;
  reports?: unknown;
};

type SubmitApiPayload = {
  ok: true;
  report?: unknown;
};

type FetchReportsErrorCode = "network" | "timeout" | "unavailable" | "invalid_payload";
type SubmitReportErrorCode =
  | "network"
  | "timeout"
  | "unavailable"
  | "invalid_payload"
  | "too_soon";

export type FetchReportsResult =
  | { ok: true; reports: MobileReport[] }
  | { ok: false; code: FetchReportsErrorCode };

export type SubmitReportResult =
  | { ok: true; report: MobileReport }
  | { ok: false; code: SubmitReportErrorCode; retryAfterSec?: number };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asCrowdLevel = (value: unknown): CrowdLevel | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) {
    return numeric;
  }
  return null;
};

const asWaterLevel = (value: unknown): WaterLevel | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) {
    return numeric;
  }
  return null;
};

const asBeachLevel = (value: unknown): BeachLevel | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === 1 || numeric === 2 || numeric === 3) {
    return numeric;
  }
  return null;
};

const parseReport = (value: unknown): MobileReport | null => {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : null;
  const beachId = typeof value.beachId === "string" ? value.beachId : null;
  const createdAt = toFiniteNumber(value.createdAt);
  const crowdLevel = asCrowdLevel(value.crowdLevel);
  if (!id || !beachId || createdAt === null || crowdLevel === null) {
    return null;
  }

  const waterCondition = asWaterLevel(value.waterCondition);
  const beachCondition = asBeachLevel(value.beachCondition);

  return {
    id,
    beachId,
    createdAt,
    crowdLevel,
    waterCondition: waterCondition ?? undefined,
    beachCondition: beachCondition ?? undefined,
  };
};

export const fetchMobileReports = async (): Promise<FetchReportsResult> => {
  const result = await apiFetchJson<ReportsApiPayload>(buildApiUrl("/reports"), {
    method: "GET",
  });
  if (!result.ok) return { ok: false, code: result.code };

  if (!result.data || result.data.ok !== true || !Array.isArray(result.data.reports)) {
    return { ok: false, code: "invalid_payload" };
  }

  const reports = result.data.reports
    .map((entry) => parseReport(entry))
    .filter((entry): entry is MobileReport => entry !== null);

  return { ok: true, reports };
};

export const submitMobileReport = async (input: {
  beachId: string;
  crowdLevel: CrowdLevel;
  waterCondition?: WaterLevel;
  beachCondition?: BeachLevel;
}): Promise<SubmitReportResult> => {
  const reporterHash = await getReporterHash();
  const nowIso = new Date().toISOString();

  const payload = {
    beachId: input.beachId,
    crowdLevel: input.crowdLevel,
    waterCondition: input.waterCondition,
    beachCondition: input.beachCondition,
    reporterHash,
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

  const result = await apiFetchJson<SubmitApiPayload>(buildApiUrl("/reports"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    if (result.status === 429 || result.error === "too_soon") {
      return {
        ok: false,
        code: "too_soon",
        retryAfterSec: result.retryAfterSec,
      };
    }

    if (
      result.error === "invalid_body" ||
      result.error === "invalid_beach_id" ||
      result.error === "invalid_crowd_level" ||
      result.error === "invalid_water_condition" ||
      result.error === "invalid_beach_condition" ||
      result.error === "invalid_reporter_hash"
    ) {
      return { ok: false, code: "invalid_payload" };
    }

    return { ok: false, code: result.code };
  }

  if (!result.data || result.data.ok !== true) {
    return { ok: false, code: "invalid_payload" };
  }

  const report = parseReport(result.data.report);
  if (!report) {
    return { ok: false, code: "invalid_payload" };
  }

  return { ok: true, report };
};
