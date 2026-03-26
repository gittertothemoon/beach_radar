export type PriceBand = "low" | "mid" | "high" | "premium" | "unknown";

export type SourceType = "official" | "google" | "search";

export type ReviewDecision = "verified" | "rejected" | "conflict" | "needs_review";

export type FieldName = "hours" | "services" | "phone" | "website" | "priceBand";

export type FieldEvidence = {
  field: FieldName;
  sourceType: SourceType;
  url: string;
  snippet: string;
  observedAt: string;
};

export type ExtractedCandidate = {
  hours: string | null;
  services: string[];
  phone: string | null;
  website: string | null;
  priceBand: PriceBand;
  sourcePrimaryUrl: string | null;
  sourceSecondaryUrl: string | null;
  fieldEvidence: FieldEvidence[];
};

export type ReviewedCandidate = {
  decision: ReviewDecision;
  conflictFlags: string[];
  fieldScores: Record<string, number>;
  reviewerScore: number;
};

export const SERVICE_TAXONOMY = [
  "Ombrelloni",
  "Lettini",
  "Bar",
  "Ristorante",
  "Parcheggio",
  "Docce",
  "Cabine",
  "Wi-Fi",
  "Accessibile",
  "Pet Friendly",
  "Area bimbi",
  "Sport acquatici",
  "Beach volley",
  "Salvataggio",
  "Prenotazione online",
] as const;

const SERVICE_SYNONYMS: Record<string, (typeof SERVICE_TAXONOMY)[number]> = {
  ombrellone: "Ombrelloni",
  ombrelloni: "Ombrelloni",
  umbrella: "Ombrelloni",
  umbrellas: "Ombrelloni",
  lettino: "Lettini",
  lettini: "Lettini",
  sunbed: "Lettini",
  sunbeds: "Lettini",
  bar: "Bar",
  ristorante: "Ristorante",
  restaurant: "Ristorante",
  parcheggio: "Parcheggio",
  parking: "Parcheggio",
  doccia: "Docce",
  docce: "Docce",
  showers: "Docce",
  cabina: "Cabine",
  cabine: "Cabine",
  cabin: "Cabine",
  wifi: "Wi-Fi",
  "wi-fi": "Wi-Fi",
  accessibile: "Accessibile",
  accessible: "Accessibile",
  disabili: "Accessibile",
  pet: "Pet Friendly",
  "pet friendly": "Pet Friendly",
  cani: "Pet Friendly",
  bambini: "Area bimbi",
  "area bimbi": "Area bimbi",
  kids: "Area bimbi",
  sport: "Sport acquatici",
  sup: "Sport acquatici",
  canoa: "Sport acquatici",
  surf: "Sport acquatici",
  volley: "Beach volley",
  "beach volley": "Beach volley",
  bagnino: "Salvataggio",
  salvataggio: "Salvataggio",
  lifeguard: "Salvataggio",
  prenotazione: "Prenotazione online",
  booking: "Prenotazione online",
  online: "Prenotazione online",
};

const PRICE_HINTS: Record<string, PriceBand> = {
  "€": "low",
  "€€": "mid",
  "€€€": "high",
  "€€€€": "premium",
  low: "low",
  economico: "low",
  cheap: "low",
  mid: "mid",
  medio: "mid",
  medium: "mid",
  high: "high",
  alto: "high",
  premium: "premium",
  lusso: "premium",
  unknown: "unknown",
};

const FIELD_CONFLICT_PRIORITY = new Set(["hours", "phone", "website"]);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeWebsite = (value: unknown): string | null => {
  const raw = asString(value);
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    const sanitized = parsed.toString();
    return sanitized.endsWith("/") ? sanitized.slice(0, -1) : sanitized;
  } catch {
    return null;
  }
};

export const normalizePhone = (value: unknown): string | null => {
  const raw = asString(value);
  if (!raw) return null;
  const normalized = raw
    .replace(/[()]/g, "")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 6 || digitCount > 15) return null;
  if (!/^[+]?[-0-9 /]{6,24}$/.test(normalized)) return null;
  return normalized;
};

export const normalizeHours = (value: unknown): string | null => {
  const raw = asString(value);
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, " ").trim();
  if (compact.length < 4 || compact.length > 180) return null;
  return compact;
};

export const normalizePriceBand = (value: unknown): PriceBand => {
  const raw = asString(value);
  if (!raw) return "unknown";
  const normalized = raw.toLowerCase();
  if (PRICE_HINTS[normalized]) return PRICE_HINTS[normalized];
  if (PRICE_HINTS[raw]) return PRICE_HINTS[raw];
  return "unknown";
};

const tokenizeServiceText = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[/|]/g, ",")
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

export const normalizeServices = (value: unknown): string[] => {
  const rawList: string[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") rawList.push(entry);
    }
  } else if (typeof value === "string") {
    rawList.push(value);
  }

  const out = new Set<string>();
  for (const source of rawList) {
    const tokens = tokenizeServiceText(source);
    for (const token of tokens) {
      const exact = SERVICE_SYNONYMS[token];
      if (exact) {
        out.add(exact);
        continue;
      }
      for (const [synonym, mapped] of Object.entries(SERVICE_SYNONYMS)) {
        if (token.includes(synonym)) {
          out.add(mapped);
          break;
        }
      }
    }
  }

  return SERVICE_TAXONOMY.filter((service) => out.has(service));
};

export const normalizeCandidate = (value: Partial<ExtractedCandidate>): ExtractedCandidate => ({
  hours: normalizeHours(value.hours),
  services: normalizeServices(value.services),
  phone: normalizePhone(value.phone),
  website: normalizeWebsite(value.website),
  priceBand: normalizePriceBand(value.priceBand),
  sourcePrimaryUrl: normalizeWebsite(value.sourcePrimaryUrl),
  sourceSecondaryUrl: normalizeWebsite(value.sourceSecondaryUrl),
  fieldEvidence: Array.isArray(value.fieldEvidence)
    ? value.fieldEvidence
      .filter((entry): entry is FieldEvidence => {
        if (!entry || typeof entry !== "object") return false;
        const item = entry as FieldEvidence;
        if (!asString(item.field)) return false;
        if (!asString(item.sourceType)) return false;
        if (!normalizeWebsite(item.url)) return false;
        return Boolean(asString(item.observedAt));
      })
      .map((entry) => ({
        field: entry.field,
        sourceType: entry.sourceType,
        url: normalizeWebsite(entry.url) as string,
        snippet: asString(entry.snippet) ?? "",
        observedAt: asString(entry.observedAt) ?? new Date().toISOString(),
      }))
    : [],
});

export const hasStrongConflict = (conflictFlags: string[]): boolean =>
  conflictFlags.some((flag) => {
    const normalized = flag.toLowerCase();
    for (const field of FIELD_CONFLICT_PRIORITY) {
      if (normalized.includes(field)) return true;
    }
    return false;
  });

export const computePublishConfidence = (input: {
  hasOfficialSource: boolean;
  hasGoogleSource: boolean;
  review: ReviewedCandidate;
  threshold: number;
}): {
  confidence: number;
  decision: "publish" | "queue";
  reason: string;
} => {
  const reviewScore = clamp(input.review.reviewerScore || 0, 0, 1);
  const strongConflict = hasStrongConflict(input.review.conflictFlags);

  let sourceScore = 0.45;
  if (input.hasOfficialSource && input.hasGoogleSource) {
    sourceScore = 0.93;
  } else if (input.hasOfficialSource) {
    sourceScore = 0.87;
  } else if (input.hasGoogleSource) {
    sourceScore = 0.72;
  }

  let confidence = sourceScore * 0.65 + reviewScore * 0.35;

  if (input.review.decision === "rejected") {
    confidence = Math.min(confidence, 0.5);
  }

  if (strongConflict) {
    confidence = Math.min(confidence, 0.79);
  } else if (input.review.decision === "conflict") {
    confidence = Math.min(
      confidence,
      input.hasOfficialSource ? 0.89 : 0.79,
    );
  }

  if (!input.hasOfficialSource && input.hasGoogleSource) {
    confidence = Math.min(confidence, 0.79);
  }

  confidence = clamp(Number(confidence.toFixed(3)), 0, 0.99);

  if (confidence >= input.threshold) {
    return { confidence, decision: "publish", reason: "above_threshold" };
  }

  if (input.review.decision === "rejected") {
    return { confidence, decision: "queue", reason: "review_rejected" };
  }
  if (strongConflict || input.review.decision === "conflict") {
    return { confidence, decision: "queue", reason: "source_conflict" };
  }
  if (!input.hasOfficialSource) {
    return { confidence, decision: "queue", reason: "official_source_missing" };
  }
  return { confidence, decision: "queue", reason: "below_threshold" };
};

export const mergeFieldScores = (
  candidate: ExtractedCandidate,
  review: ReviewedCandidate,
): Record<string, number> => {
  const result: Record<string, number> = {
    hours: candidate.hours ? 0.8 : 0,
    services: candidate.services.length > 0 ? 0.8 : 0,
    phone: candidate.phone ? 0.8 : 0,
    website: candidate.website ? 0.8 : 0,
    priceBand: candidate.priceBand !== "unknown" ? 0.75 : 0.45,
  };

  for (const [field, score] of Object.entries(review.fieldScores)) {
    const parsed = Number(score);
    if (!Number.isFinite(parsed)) continue;
    result[field] = clamp(parsed, 0, 1);
  }

  return result;
};

export const pickBestWebsite = (official: string | null, google: string | null): string | null => {
  const normalizedOfficial = normalizeWebsite(official);
  if (normalizedOfficial) return normalizedOfficial;
  return normalizeWebsite(google);
};
