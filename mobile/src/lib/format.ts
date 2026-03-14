export const formatDateTime = (timestampMs: number): string => {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
};

export const formatWeatherHour = (timestampSec: number, timezone: string): string => {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(timestampSec * 1000));
};

export const formatRainProbability = (value: number | null): string => {
  if (value === null) return "n/d";
  return `${Math.round(value)}%`;
};
