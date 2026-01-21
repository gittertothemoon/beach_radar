export const formatMinutesAgo = (updatedAt: number | null, now: number) => {
  if (!updatedAt) return "Predetto";
  const minutes = Math.max(0, Math.round((now - updatedAt) / 60000));
  if (minutes <= 1) return "ora";
  return `${minutes} min fa`;
};

export const formatDistance = (distanceM: number | null) => {
  if (distanceM === null || Number.isNaN(distanceM)) return "--";
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
};

export const formatConfidence = (value: number) =>
  `${Math.round(value * 100)}%`;

export const crowdLabel = (level: number) => {
  switch (level) {
    case 1:
      return "1 • Vuota";
    case 2:
      return "2 • Bassa";
    case 3:
      return "3 • Media";
    case 4:
      return "4 • Piena";
    default:
      return "";
  }
};
