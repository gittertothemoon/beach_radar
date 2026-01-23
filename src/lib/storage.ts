import { STRINGS } from "../i18n/it";
import type { CrowdLevel, Report } from "./types";

const REPORTS_KEY = "beach-radar-reports-v1";
const REPORTER_KEY = "beach-radar-reporter-v1";
const RATE_LIMIT_MIN = 10;

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const getReporterHash = (): string => {
  const existing = localStorage.getItem(REPORTER_KEY);
  if (existing) return existing;
  const hash = randomHex(16);
  localStorage.setItem(REPORTER_KEY, hash);
  return hash;
};

export const loadReports = (): Report[] => {
  const raw = localStorage.getItem(REPORTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Report[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (report) =>
        typeof report.id === "string" &&
        typeof report.beachId === "string" &&
        typeof report.createdAt === "number" &&
        typeof report.reporterHash === "string" &&
        [1, 2, 3, 4].includes(report.crowdLevel),
    );
  } catch {
    return [];
  }
};

export const saveReports = (reports: Report[]) => {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
};

export const tryAddReport = (input: {
  beachId: string;
  crowdLevel: CrowdLevel;
  reporterHash: string;
  now?: number;
}): { ok: true; reports: Report[] } | { ok: false; reason: string } => {
  const now = input.now ?? Date.now();
  const reports = loadReports();
  const recent = reports
    .filter(
      (report) =>
        report.beachId === input.beachId &&
        report.reporterHash === input.reporterHash,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (recent && now - recent.createdAt < RATE_LIMIT_MIN * 60 * 1000) {
    return {
      ok: false,
      reason: STRINGS.report.tooSoon,
    };
  }

  const newReport: Report = {
    id: randomHex(12),
    beachId: input.beachId,
    createdAt: now,
    crowdLevel: input.crowdLevel,
    reporterHash: input.reporterHash,
  };

  const nextReports = [newReport, ...reports];
  saveReports(nextReports);
  return { ok: true, reports: nextReports };
};
