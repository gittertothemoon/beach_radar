import type { Beach, BeachStats, CrowdLevel, Report } from "./types";

export const REPORT_TTL_MIN = 30;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const calcWeight = (ageMin: number) => Math.exp(-ageMin / 18) * 1;

export const aggregateBeachStats = (
  beach: Beach,
  reports: Report[],
  now: number,
): BeachStats => {
  const active = reports.filter((report) => {
    if (report.beachId !== beach.id) return false;
    const ageMin = (now - report.createdAt) / 60000;
    return ageMin <= REPORT_TTL_MIN;
  });

  if (active.length === 0) {
    return {
      crowdLevel: beach.baselineLevel ?? 2,
      state: "PRED",
      confidence: 0.15,
      updatedAt: null,
      reportsCount: 0,
    };
  }

  const weights = new Map<CrowdLevel, number>();
  let totalWeight = 0;
  let latestReportAt = 0;

  active.forEach((report) => {
    const ageMin = (now - report.createdAt) / 60000;
    const weight = calcWeight(ageMin);
    totalWeight += weight;
    weights.set(report.crowdLevel, (weights.get(report.crowdLevel) ?? 0) + weight);
    if (report.createdAt > latestReportAt) latestReportAt = report.createdAt;
  });

  const levels: CrowdLevel[] = [1, 2, 3, 4];
  let bestLevel: CrowdLevel = levels[0];
  let bestWeight = -1;

  levels.forEach((level) => {
    const weight = weights.get(level) ?? 0;
    if (weight > bestWeight || (weight === bestWeight && level > bestLevel)) {
      bestWeight = weight;
      bestLevel = level;
    }
  });

  const updatedMin = (now - latestReportAt) / 60000;
  const agreement = totalWeight > 0 ? bestWeight / totalWeight : 0;
  const nBoost = Math.min(1, active.length / 10);
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
    reportsCount: active.length,
  };
};
