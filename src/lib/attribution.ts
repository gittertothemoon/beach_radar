import type { AttributionSnapshot } from "./types";

export type AttributionParams = {
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const ATTRIBUTION_KEY = "br_attribution_v1";
export const ATTRIBUTION_UPDATE_EVENT = "br_attribution_updated";

const normalizeValue = (value: string | null | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const hasAttributionParams = (params: AttributionParams) =>
  Boolean(
    params.src || params.utm_source || params.utm_medium || params.utm_campaign,
  );

const notifyAttributionUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ATTRIBUTION_UPDATE_EVENT));
};

export const extractAttributionParams = (
  searchParams: URLSearchParams,
): AttributionParams => ({
  src: normalizeValue(searchParams.get("src")),
  utm_source: normalizeValue(searchParams.get("utm_source")),
  utm_medium: normalizeValue(searchParams.get("utm_medium")),
  utm_campaign: normalizeValue(searchParams.get("utm_campaign")),
});

const isValidAttribution = (value: unknown): value is AttributionSnapshot => {
  if (!value || typeof value !== "object") return false;
  const record = value as AttributionSnapshot;
  if (record.v !== 1) return false;
  if (typeof record.first_seen_at !== "string") return false;
  if (typeof record.last_seen_at !== "string") return false;
  return true;
};

export const loadAttribution = (): AttributionSnapshot | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AttributionSnapshot;
    if (!isValidAttribution(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const upsertAttribution = (
  params: AttributionParams,
): AttributionSnapshot | null => {
  if (typeof window === "undefined") return null;
  const normalized: AttributionParams = {
    src: normalizeValue(params.src),
    utm_source: normalizeValue(params.utm_source),
    utm_medium: normalizeValue(params.utm_medium),
    utm_campaign: normalizeValue(params.utm_campaign),
  };
  if (!hasAttributionParams(normalized)) return null;

  const existing = loadAttribution();
  const nowISO = new Date().toISOString();
  const next: AttributionSnapshot = {
    v: 1,
    src: normalized.src ?? existing?.src,
    utm_source: normalized.utm_source ?? existing?.utm_source,
    utm_medium: normalized.utm_medium ?? existing?.utm_medium,
    utm_campaign: normalized.utm_campaign ?? existing?.utm_campaign,
    first_seen_at: existing?.first_seen_at ?? nowISO,
    last_seen_at: nowISO,
  };

  window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  notifyAttributionUpdate();
  return next;
};

export const clearAttribution = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ATTRIBUTION_KEY);
  notifyAttributionUpdate();
};
