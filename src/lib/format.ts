import { STRINGS } from "../i18n/it";
import type { BeachState } from "./types";

export const formatMinutesAgo = (updatedAt: number | null, now: number) => {
  if (!updatedAt) return STRINGS.status.pred;
  const minutes = Math.max(0, Math.round((now - updatedAt) / 60000));
  if (minutes <= 1) return STRINGS.time.now;
  return STRINGS.time.minutesAgo(minutes);
};

export const formatDistance = (distanceM: number | null) => {
  if (distanceM === null || Number.isNaN(distanceM)) return "--";
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
};

export const formatDistanceLabel = (distanceM: number | null) => {
  if (distanceM === null || Number.isNaN(distanceM)) {
    return STRINGS.distance.unknown;
  }
  if (distanceM <= 1500) return STRINGS.distance.near;
  if (distanceM <= 10000) return STRINGS.distance.mid;
  return STRINGS.distance.far;
};

export const formatConfidence = (value: number) => {
  const percent = Math.round(value * 100);
  if (percent < 40) return STRINGS.confidence.low;
  if (percent <= 70) return STRINGS.confidence.medium;
  return STRINGS.confidence.high;
};

export const formatConfidenceInline = (value: number) =>
  STRINGS.confidence.inline(formatConfidence(value));

export const formatStateLabel = (state: BeachState) => {
  switch (state) {
    case "LIVE":
      return STRINGS.status.live;
    case "RECENT":
      return STRINGS.status.recent;
    default:
      return STRINGS.status.pred;
  }
};

export const formatReportCount = (count: number) => {
  if (count <= 0) return STRINGS.reports.noneRecent;
  return STRINGS.reports.count(count);
};

export const crowdLabel = (level: number) => {
  switch (level) {
    case 1:
      return `1 • ${STRINGS.crowdLevels[1]}`;
    case 2:
      return `2 • ${STRINGS.crowdLevels[2]}`;
    case 3:
      return `3 • ${STRINGS.crowdLevels[3]}`;
    case 4:
      return `4 • ${STRINGS.crowdLevels[4]}`;
    default:
      return "";
  }
};
