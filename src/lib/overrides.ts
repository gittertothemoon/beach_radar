export type BeachOverride = {
  lat: number;
  lng: number;
  updatedAt: number;
};

export type BeachOverrides = Record<string, BeachOverride>;

const STORAGE_KEY = "br_beach_overrides_v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const loadOverrides = (): BeachOverrides => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return parsed as BeachOverrides;
  } catch {
    return {};
  }
};

export const saveOverrides = (overrides: BeachOverrides) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
};

export const getOverride = (beachId: string): BeachOverride | null => {
  const overrides = loadOverrides();
  return overrides[beachId] ?? null;
};

export const setOverride = (
  beachId: string,
  lat: number,
  lng: number,
): BeachOverrides => {
  const overrides = loadOverrides();
  overrides[beachId] = { lat, lng, updatedAt: Date.now() };
  saveOverrides(overrides);
  return overrides;
};

export const clearOverride = (beachId: string): BeachOverrides => {
  const overrides = loadOverrides();
  if (beachId in overrides) {
    delete overrides[beachId];
    saveOverrides(overrides);
  }
  return overrides;
};
