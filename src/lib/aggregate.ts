import type { Beach, BeachStats, CrowdLevel, Report } from "./types";

export const REPORT_TTL_MIN = 30;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const calcWeight = (ageMin: number) => Math.exp(-ageMin / 18) * 1;

export type ReportsIndex = Map<string, Report[]>;

export const buildReportsIndex = (reports: Report[]): ReportsIndex => {
  const index: ReportsIndex = new Map();
  for (const report of reports) {
    const bucket = index.get(report.beachId);
    if (bucket) {
      bucket.push(report);
    } else {
      index.set(report.beachId, [report]);
    }
  }
  index.forEach((bucket) => {
    bucket.sort((a, b) => b.createdAt - a.createdAt);
  });
  return index;
};

const aggregateFromReports = (
  _beach: Beach,
  reports: Report[],
  now: number,
): BeachStats => {
  const weights = new Map<CrowdLevel, number>();
  let totalWeight = 0;
  let latestReportAt = 0;
  let activeCount = 0;

  for (const report of reports) {
    const ageMin = (now - report.createdAt) / 60000;
    if (ageMin > REPORT_TTL_MIN) {
      // Reports are sorted by createdAt desc, so we can stop early.
      break;
    }
    activeCount += 1;
    const weight = calcWeight(ageMin);
    totalWeight += weight;
    weights.set(report.crowdLevel, (weights.get(report.crowdLevel) ?? 0) + weight);
    if (report.createdAt > latestReportAt) latestReportAt = report.createdAt;
  }

  if (activeCount === 0) {
    return {
      crowdLevel: 1 as CrowdLevel,
      state: "PRED",
      confidence: 0.15,
      updatedAt: null,
      reportsCount: 0,
    };
  }

  const levels: CrowdLevel[] = [1, 2, 3, 4];
  let bestLevel: CrowdLevel = levels[0];
  let bestWeight = -1;

  for (const level of levels) {
    const weight = weights.get(level) ?? 0;
    if (weight > bestWeight || (weight === bestWeight && level > bestLevel)) {
      bestWeight = weight;
      bestLevel = level;
    }
  }

  const updatedMin = (now - latestReportAt) / 60000;
  const agreement = totalWeight > 0 ? bestWeight / totalWeight : 0;
  const nBoost = Math.min(1, activeCount / 10);
  const recencyBoost = clamp(1 - updatedMin / 45, 0, 1);

  const confidence = clamp(
    0.15 + 0.55 * agreement + 0.2 * nBoost + 0.1 * recencyBoost,
    0,
    1,
  );

  const state = updatedMin <= 5 ? "LIVE" : "RECENT";

  return {
    crowdLevel: bestLevel,
    state,
    confidence,
    updatedAt: latestReportAt,
    reportsCount: activeCount,
  };
};

export const aggregateBeachStatsFromIndex = (
  beach: Beach,
  reportsIndex: ReportsIndex,
  now: number,
) => {
  const reports = reportsIndex.get(beach.id);
  if (!reports || reports.length === 0) {
    return {
      crowdLevel: 1 as CrowdLevel,
      state: "PRED" as const,
      confidence: 0.15,
      updatedAt: null,
      reportsCount: 0,
    };
  }
  return aggregateFromReports(beach, reports, now);
};

export const aggregateBeachStats = (
  beach: Beach,
  reports: Report[],
  now: number,
): BeachStats => {
  const reportsIndex = buildReportsIndex(reports);
  return aggregateBeachStatsFromIndex(beach, reportsIndex, now);
};
