import type { BeachProfile } from "./types";

export type FetchBeachProfileResult =
  | { ok: true; profile: BeachProfile | null }
  | { ok: false; error: "network" | "invalid_payload" | "unavailable" };

type ApiSuccessPayload = {
  ok: true;
  profile?: unknown;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseProfile = (value: unknown): BeachProfile | null => {
  if (!isObject(value)) return null;

  const beachId = asString(value.beachId);
  if (!beachId) return null;

  const sources = Array.isArray(value.sources)
    ? value.sources
      .filter((entry): entry is Record<string, unknown> => isObject(entry))
      .map((entry) => {
        const url = asString(entry.url);
        if (!url) return null;
        const sourceTypeRaw = asString(entry.sourceType);
        const sourceType =
          sourceTypeRaw === "official" ||
            sourceTypeRaw === "google" ||
            sourceTypeRaw === "search"
            ? sourceTypeRaw
            : "source";
        return {
          label: asString(entry.label) ?? "Fonte",
          url,
          sourceType,
        } as BeachProfile["sources"][number];
      })
      .filter((entry): entry is BeachProfile["sources"][number] => Boolean(entry))
    : [];

  const statusRaw = asString(value.status);
  const status =
    statusRaw === "published" || statusRaw === "needs_review" || statusRaw === "stale"
      ? statusRaw
      : "published";

  const priceBandRaw = asString(value.priceBand);
  const priceBand =
    priceBandRaw === "low" ||
      priceBandRaw === "mid" ||
      priceBandRaw === "high" ||
      priceBandRaw === "premium" ||
      priceBandRaw === "unknown"
      ? priceBandRaw
      : "unknown";

  return {
    beachId,
    hours: asString(value.hours),
    services: Array.isArray(value.services)
      ? value.services.filter((entry): entry is string => typeof entry === "string")
      : [],
    phone: asString(value.phone),
    website: asString(value.website),
    priceBand,
    confidence: asNumber(value.confidence) ?? 0,
    verifiedAt: asString(value.verifiedAt),
    status,
    sources,
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const fetchBeachProfile = async (
  beachId: string,
  signal?: AbortSignal,
): Promise<FetchBeachProfileResult> => {
  let response: Response;
  try {
    const query = new URLSearchParams({ beachId });
    response = await fetch(`/api/beach-profile?${query.toString()}`, {
      method: "GET",
      signal,
    });
  } catch {
    return { ok: false, error: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: "unavailable" };
  }

  const parsed = payload as ApiSuccessPayload;
  if (!parsed || parsed.ok !== true) {
    return { ok: false, error: "invalid_payload" };
  }

  if (parsed.profile == null) {
    return { ok: true, profile: null };
  }

  const profile = parseProfile(parsed.profile);
  if (!profile) {
    return { ok: false, error: "invalid_payload" };
  }

  return { ok: true, profile };
};
