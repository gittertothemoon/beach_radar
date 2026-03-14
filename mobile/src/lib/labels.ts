import type { BeachLevel, CrowdLevel, WaterLevel } from "../types/domain";

export const crowdLevelLabel = (value: CrowdLevel): string => {
  if (value === 1) return "Vuota";
  if (value === 2) return "Scorrevole";
  if (value === 3) return "Affollata";
  return "Piena";
};

export const waterLevelLabel = (value: WaterLevel): string => {
  if (value === 1) return "Calma";
  if (value === 2) return "Mossa";
  if (value === 3) return "Agitata";
  return "Molto agitata";
};

export const beachLevelLabel = (value: BeachLevel): string => {
  if (value === 1) return "Pulita";
  if (value === 2) return "Normale";
  return "Sporca";
};

export const weatherConditionLabel = (code: number): string => {
  if (code === 0) return "Sereno";
  if (code === 1) return "Poco nuvoloso";
  if (code === 2) return "Nuvoloso";
  if (code === 3) return "Coperto";
  if (code === 45 || code === 48) return "Nebbia";
  if (code >= 51 && code <= 57) return "Pioggerella";
  if (code >= 61 && code <= 67) return "Pioggia";
  if (code >= 71 && code <= 77) return "Neve";
  if (code >= 80 && code <= 82) return "Rovesci";
  if (code >= 95 && code <= 99) return "Temporale";
  return "Condizioni variabili";
};

const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const windDirectionLabel = (degrees: number | null): string | null => {
  if (degrees === null) return null;
  const sector = Math.round(normalizeDegrees(degrees) / 45) % 8;
  if (sector === 0) return "N";
  if (sector === 1) return "NE";
  if (sector === 2) return "E";
  if (sector === 3) return "SE";
  if (sector === 4) return "S";
  if (sector === 5) return "SO";
  if (sector === 6) return "O";
  return "NO";
};
