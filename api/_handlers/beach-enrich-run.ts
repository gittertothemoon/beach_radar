import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  computePublishConfidence,
  mergeFieldScores,
  normalizeCandidate,
  normalizePriceBand,
  pickBestWebsite,
  type ExtractedCandidate,
  type FieldEvidence,
  type ReviewedCandidate,
} from "../_lib/beach-enrichment.js";
import { updateTestModeStore } from "./test-mode-store.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const GOOGLE_PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";
const CATALOG_PATH_CANDIDATES = [
  path.resolve(process.cwd(), "src/data/BeachRadar_Rimini_100_geocoded.json"),
  path.resolve(process.cwd(), "../src/data/BeachRadar_Rimini_100_geocoded.json"),
];
const PRIORITY_OVERRIDES_PATH_CANDIDATES = [
  path.resolve(process.cwd(), "data/raw/beach-enrichment-priority-overrides.json"),
  path.resolve(process.cwd(), "../data/raw/beach-enrichment-priority-overrides.json"),
];
const TEST_MODE = process.env.BEACH_ENRICH_TEST_MODE === "1";
const TEST_STORE_FILE = "beach-enrichment-state.json";
const BEACH_ID_PATTERN = /^BR-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/;

type BeachCatalogItem = {
  id: string;
  name: string;
  city: string;
  region: string;
};

type SourceBundle = {
  officialUrl: string | null;
  googleMapsUrl: string | null;
  googleWebsite: string | null;
  googlePhone: string | null;
  googleHours: string | null;
  googlePriceBand: string | null;
  searchTopUrl: string | null;
  searchTopSnippet: string | null;
  searchResults: Array<{ title: string; link: string; snippet: string }>;
};

type RunCounters = {
  processed: number;
  published: number;
  queued: number;
  failed: number;
};

type TestProfileRow = {
  beach_id: string;
  hours: string | null;
  services: string[] | null;
  phone: string | null;
  website: string | null;
  price_band: string | null;
  confidence: number | null;
  verified_at: string | null;
  status: string | null;
  sources: unknown;
};

type TestCandidateRow = {
  id: string;
  beach_id: string;
  review_round: number;
  confidence: number;
  review_decision: string;
  conflict_flags: string[];
  field_scores: Record<string, number>;
  candidate_payload: Record<string, unknown>;
  field_evidence: FieldEvidence[];
  created_at: string;
};

type TestQueueRow = {
  id: string;
  beach_id: string;
  candidate_id: string;
  reason: string;
  priority_score: number;
  conflict_flags: string[];
  attempts: number;
  last_attempt_at: string;
  status: "pending" | "in_review" | "resolved";
  updated_at: string;
  created_at: string;
};

type TestRunRow = {
  id: string;
  trigger_source: string;
  status: "running" | "completed" | "failed";
  run_day_rome: string;
  started_at: string;
  finished_at: string | null;
  batch_size: number;
  processed_count: number;
  published_count: number;
  queued_count: number;
  failed_count: number;
  notes: Record<string, unknown>;
};

type TestStoreState = {
  runs: TestRunRow[];
  current: Record<string, TestProfileRow>;
  candidates: TestCandidateRow[];
  queue: Record<string, TestQueueRow>;
};

function createTestStore(): TestStoreState {
  return {
    runs: [],
    current: {},
    candidates: [],
    queue: {},
  };
}

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function readNumberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function toSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
  }
  return null;
}

function readBearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function isAuthorized(req: VercelRequest): { ok: boolean; missingConfig: boolean } {
  const cronSecret = readEnv("CRON_SECRET");
  if (!cronSecret) return { ok: false, missingConfig: true };
  const token = readBearerToken(req);
  return { ok: token === cronSecret, missingConfig: false };
}

function createSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

type SupabaseClientLike = NonNullable<ReturnType<typeof createSupabaseClient>>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function resolveExistingPath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadBeachCatalog(): Promise<BeachCatalogItem[]> {
  const catalogPath = await resolveExistingPath(CATALOG_PATH_CANDIDATES);
  if (!catalogPath) return [];
  const raw = await fs.readFile(catalogPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const catalog: BeachCatalogItem[] = [];
  for (const item of parsed) {
    if (!isObject(item)) continue;
    const id = toSingleString(item.id);
    const name = toSingleString(item.name);
    if (!id || !name || !BEACH_ID_PATTERN.test(id)) continue;
    catalog.push({
      id,
      name,
      city: toSingleString(item.city) ?? "",
      region: toSingleString(item.region) ?? "",
    });
  }
  return catalog;
}

async function loadPriorityOverrides(): Promise<Record<string, number>> {
  try {
    const overridesPath = await resolveExistingPath(PRIORITY_OVERRIDES_PATH_CANDIDATES);
    if (!overridesPath) return {};
    const raw = await fs.readFile(overridesPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!BEACH_ID_PATTERN.test(key)) continue;
      const weight = Number(value);
      if (!Number.isFinite(weight)) continue;
      out[key] = weight;
    }
    return out;
  } catch {
    return {};
  }
}

function getRomeDayKey(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function cityWeights(catalog: BeachCatalogItem[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const beach of catalog) {
    const city = beach.city.trim().toLowerCase();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  let maxCount = 1;
  for (const count of counts.values()) {
    maxCount = Math.max(maxCount, count);
  }

  const out: Record<string, number> = {};
  for (const [city, count] of counts.entries()) {
    out[city] = Number((count / maxCount).toFixed(4));
  }
  return out;
}

function brandBoost(name: string): number {
  const value = name.toLowerCase();
  const patterns = [
    /beach club/,
    /grand hotel/,
    /papeete/,
    /stabilimento/,
    /lido/,
    /bagno\s+\d+/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(value)) return 0.45;
  }
  return 0;
}

function sumCountMap(rows: Array<Record<string, unknown>>, keyName: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const beachId = toSingleString(row[keyName]);
    if (!beachId) continue;
    map.set(beachId, (map.get(beachId) ?? 0) + 1);
  }
  return map;
}

async function loadSignalMaps(supabase: SupabaseClientLike) {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [analyticsRes, favoritesRes, reviewsRes] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("beach_id, event_name")
      .not("beach_id", "is", null)
      .gte("created_at", sinceIso)
      .limit(20_000),
    supabase
      .from("user_favorites")
      .select("beach_id")
      .limit(20_000),
    supabase
      .from("beach_reviews")
      .select("beach_id")
      .limit(20_000),
  ]);

  const analyticsRaw: unknown[] = Array.isArray(analyticsRes.data)
    ? analyticsRes.data
    : [];
  const analyticsRows = analyticsRaw.filter(isObject);

  const analyticsMap = new Map<string, number>();
  for (const row of analyticsRows) {
    const beachId = toSingleString(row.beach_id);
    if (!beachId) continue;
    const eventName = toSingleString(row.event_name) ?? "";
    const weight = eventName === "beach_view" ? 2 : 1;
    analyticsMap.set(beachId, (analyticsMap.get(beachId) ?? 0) + weight);
  }

  const favoritesRaw: unknown[] = Array.isArray(favoritesRes.data)
    ? favoritesRes.data
    : [];
  const reviewsRaw: unknown[] = Array.isArray(reviewsRes.data)
    ? reviewsRes.data
    : [];
  const favoritesRows = favoritesRaw.filter(isObject);
  const reviewsRows = reviewsRaw.filter(isObject);

  return {
    analytics: analyticsMap,
    favorites: sumCountMap(favoritesRows, "beach_id"),
    reviews: sumCountMap(reviewsRows, "beach_id"),
  };
}

function normalizedScore(value: number, baseline = 8): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log1p(value) / Math.log1p(baseline));
}

function isFreshProfile(verifiedAt: string | null | undefined, refreshDays: number): boolean {
  if (!verifiedAt) return false;
  const ts = Date.parse(verifiedAt);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs < refreshDays * 24 * 60 * 60 * 1000;
}

function buildPriorityList(input: {
  catalog: BeachCatalogItem[];
  overrides: Record<string, number>;
  cityWeightMap: Record<string, number>;
  analyticsMap: Map<string, number>;
  favoritesMap: Map<string, number>;
  reviewsMap: Map<string, number>;
  existingProfiles: Map<string, { verified_at: string | null }>;
  refreshDays: number;
}) {
  const scored = input.catalog
    .map((beach) => {
      const existing = input.existingProfiles.get(beach.id);
      const stale = !existing || !isFreshProfile(existing.verified_at, input.refreshDays);
      if (!stale) return null;

      const cityWeight = input.cityWeightMap[beach.city.trim().toLowerCase()] ?? 0;
      const analytics = normalizedScore(input.analyticsMap.get(beach.id) ?? 0, 20);
      const favorites = normalizedScore(input.favoritesMap.get(beach.id) ?? 0, 8);
      const reviews = normalizedScore(input.reviewsMap.get(beach.id) ?? 0, 8);
      const boost = brandBoost(beach.name);
      const override = input.overrides[beach.id] ?? 0;

      const score =
        cityWeight * 0.35 +
        analytics * 0.3 +
        favorites * 0.18 +
        reviews * 0.12 +
        boost +
        override;

      return {
        beach,
        score,
      };
    })
    .filter((entry): entry is { beach: BeachCatalogItem; score: number } => Boolean(entry));

  scored.sort((a, b) => b.score - a.score || a.beach.id.localeCompare(b.beach.id));
  return scored;
}

async function fetchJsonWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function fetchSourceBundle(beach: BeachCatalogItem): Promise<SourceBundle> {
  const placesKey = readEnv("GOOGLE_PLACES_API_KEY");
  const searchKey = readEnv("GOOGLE_SEARCH_API_KEY");
  const searchCx = readEnv("GOOGLE_SEARCH_CX");

  let googleMapsUrl: string | null = null;
  let googleWebsite: string | null = null;
  let googlePhone: string | null = null;
  let googleHours: string | null = null;
  let googlePriceBand: string | null = null;

  if (placesKey) {
    const query = encodeURIComponent(`${beach.name} ${beach.city} stabilimento balneare`);
    const placeSearchRaw = await fetchJsonWithTimeout(
      `${GOOGLE_PLACES_TEXT_URL}?query=${query}&language=it&region=it&key=${encodeURIComponent(placesKey)}`,
      { method: "GET" },
    );

    if (isObject(placeSearchRaw) && Array.isArray(placeSearchRaw.results) && placeSearchRaw.results.length > 0) {
      const first = isObject(placeSearchRaw.results[0]) ? placeSearchRaw.results[0] : null;
      const placeId = first ? asString(first.place_id) : null;

      if (placeId) {
        const detailFields =
          "name,formatted_phone_number,website,opening_hours,url,price_level,business_status";
        const detailRaw = await fetchJsonWithTimeout(
          `${GOOGLE_PLACES_DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(
            detailFields,
          )}&language=it&key=${encodeURIComponent(placesKey)}`,
          { method: "GET" },
        );

        if (isObject(detailRaw) && isObject(detailRaw.result)) {
          const detail = detailRaw.result;
          googleMapsUrl = asString(detail.url);
          googleWebsite = asString(detail.website);
          googlePhone = asString(detail.formatted_phone_number);
          if (isObject(detail.opening_hours) && Array.isArray(detail.opening_hours.weekday_text)) {
            const weekdayText = detail.opening_hours.weekday_text
              .filter((entry): entry is string => typeof entry === "string")
              .join(" | ");
            googleHours = weekdayText || null;
          }
          const priceLevel = Number(detail.price_level);
          if (Number.isFinite(priceLevel)) {
            if (priceLevel <= 1) googlePriceBand = "low";
            else if (priceLevel === 2) googlePriceBand = "mid";
            else if (priceLevel === 3) googlePriceBand = "high";
            else googlePriceBand = "premium";
          }
        }
      }
    }
  }

  const searchResults: Array<{ title: string; link: string; snippet: string }> = [];
  let searchTopUrl: string | null = null;
  let searchTopSnippet: string | null = null;

  if (searchKey && searchCx) {
    const query = encodeURIComponent(`${beach.name} ${beach.city} sito ufficiale lido`);
    const searchRaw = await fetchJsonWithTimeout(
      `${GOOGLE_SEARCH_URL}?key=${encodeURIComponent(searchKey)}&cx=${encodeURIComponent(
        searchCx,
      )}&q=${query}&num=5&hl=it&gl=it`,
      { method: "GET" },
    );

    if (isObject(searchRaw) && Array.isArray(searchRaw.items)) {
      for (const item of searchRaw.items) {
        if (!isObject(item)) continue;
        const link = asString(item.link);
        if (!link) continue;
        const title = asString(item.title) ?? "Fonte web";
        const snippet = asString(item.snippet) ?? "";
        searchResults.push({ title, link, snippet });
      }
    }

    const firstUseful = searchResults.find((entry) => {
      const normalized = entry.link.toLowerCase();
      if (normalized.includes("google.com/maps")) return false;
      if (normalized.includes("/search?")) return false;
      return true;
    });

    if (firstUseful) {
      searchTopUrl = firstUseful.link;
      searchTopSnippet = firstUseful.snippet;
    }
  }

  const officialUrl = pickBestWebsite(searchTopUrl, googleWebsite);

  return {
    officialUrl,
    googleMapsUrl,
    googleWebsite,
    googlePhone,
    googleHours,
    googlePriceBand,
    searchTopUrl,
    searchTopSnippet,
    searchResults,
  };
}

function firstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

async function callOpenAIJson(args: {
  model: string;
  reasoningEffort: "low" | "medium";
  system: string;
  user: string;
}): Promise<Record<string, unknown> | null> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return null;

  const payload = {
    model: args.model,
    reasoning: {
      effort: args.reasoningEffort,
    },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: args.system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: args.user }],
      },
    ],
  };

  const raw = await fetchJsonWithTimeout(
    OPENAI_RESPONSES_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    },
    25_000,
  );

  if (!isObject(raw)) return null;
  const outputText = asString(raw.output_text);
  if (!outputText) return null;

  const jsonText = firstJsonObject(outputText);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isObject(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildFallbackCandidate(beach: BeachCatalogItem, sources: SourceBundle): ExtractedCandidate {
  const fieldEvidence: FieldEvidence[] = [];
  const nowIso = new Date().toISOString();

  if (sources.officialUrl) {
    fieldEvidence.push({
      field: "website",
      sourceType: "official",
      url: sources.officialUrl,
      snippet: "Fonte ufficiale individuata da ricerca.",
      observedAt: nowIso,
    });
  }

  if (sources.googleMapsUrl) {
    fieldEvidence.push({
      field: "hours",
      sourceType: "google",
      url: sources.googleMapsUrl,
      snippet: sources.googleHours ?? "Orari letti da Google Places.",
      observedAt: nowIso,
    });
  }

  return normalizeCandidate({
    hours: sources.googleHours,
    services: ["Ombrelloni", "Lettini", "Bar"],
    phone: sources.googlePhone,
    website: pickBestWebsite(sources.officialUrl, sources.googleWebsite),
    priceBand: normalizePriceBand(sources.googlePriceBand),
    sourcePrimaryUrl: sources.officialUrl,
    sourceSecondaryUrl: sources.googleMapsUrl,
    fieldEvidence,
  });
}

async function runExtractionAgent(
  beach: BeachCatalogItem,
  sources: SourceBundle,
): Promise<ExtractedCandidate> {
  const model = readEnv("BEACH_ENRICH_EXTRACT_MODEL") ?? "gpt-5.4-nano";
  const sourceSummary = {
    beach,
    sources,
  };

  const system = [
    "Estrai dati affidabili di un lido italiano da fonti aggregate.",
    "Rispondi SOLO con JSON valido.",
    "Campi richiesti: hours, services, phone, website, priceBand, sourcePrimaryUrl, sourceSecondaryUrl, fieldEvidence.",
    "priceBand ammesso: low|mid|high|premium|unknown.",
    "services deve essere array di stringhe concise.",
    "fieldEvidence deve essere array con: field, sourceType(official|google|search), url, snippet, observedAt.",
  ].join("\n");

  const user = `Dati input:\n${JSON.stringify(sourceSummary, null, 2)}`;
  const parsed = await callOpenAIJson({
    model,
    reasoningEffort: "low",
    system,
    user,
  });

  if (!parsed) return buildFallbackCandidate(beach, sources);

  const fieldEvidence = Array.isArray(parsed.fieldEvidence)
    ? parsed.fieldEvidence
      .filter((entry): entry is FieldEvidence => isObject(entry))
      .map((entry) => ({
        field: (toSingleString(entry.field) as FieldEvidence["field"]) ?? "website",
        sourceType: (toSingleString(entry.sourceType) as FieldEvidence["sourceType"]) ?? "search",
        url: toSingleString(entry.url) ?? sources.searchTopUrl ?? "",
        snippet: toSingleString(entry.snippet) ?? "",
        observedAt: toSingleString(entry.observedAt) ?? new Date().toISOString(),
      }))
      .filter((entry) => entry.url.length > 0)
    : [];

  return normalizeCandidate({
    hours: toSingleString(parsed.hours),
    services: Array.isArray(parsed.services)
      ? parsed.services.filter((entry): entry is string => typeof entry === "string")
      : [],
    phone: toSingleString(parsed.phone),
    website: toSingleString(parsed.website),
    priceBand: normalizePriceBand(toSingleString(parsed.priceBand)),
    sourcePrimaryUrl: toSingleString(parsed.sourcePrimaryUrl) ?? sources.officialUrl,
    sourceSecondaryUrl: toSingleString(parsed.sourceSecondaryUrl) ?? sources.googleMapsUrl,
    fieldEvidence,
  });
}

function buildFallbackReview(candidate: ExtractedCandidate): ReviewedCandidate {
  return {
    decision: candidate.website || candidate.phone ? "verified" : "needs_review",
    conflictFlags: [],
    fieldScores: {
      hours: candidate.hours ? 0.8 : 0,
      services: candidate.services.length > 0 ? 0.8 : 0,
      phone: candidate.phone ? 0.85 : 0,
      website: candidate.website ? 0.85 : 0,
      priceBand: candidate.priceBand !== "unknown" ? 0.75 : 0.45,
    },
    reviewerScore: candidate.website || candidate.phone ? 0.86 : 0.55,
  };
}

async function runReviewAgent(
  beach: BeachCatalogItem,
  candidate: ExtractedCandidate,
  sources: SourceBundle,
): Promise<ReviewedCandidate> {
  const model = readEnv("BEACH_ENRICH_REVIEW_MODEL") ?? "gpt-5.4";
  const system = [
    "Valuta se i dati estratti di un lido sono affidabili.",
    "Rispondi SOLO con JSON valido.",
    "Campi richiesti: decision, conflictFlags, fieldScores, reviewerScore.",
    "decision ammesso: verified|rejected|conflict|needs_review.",
    "reviewerScore deve essere tra 0 e 1.",
  ].join("\n");

  const user = `Lido:\n${JSON.stringify(beach, null, 2)}\n\nCandidate:\n${JSON.stringify(
    candidate,
    null,
    2,
  )}\n\nSources:\n${JSON.stringify(sources, null, 2)}`;

  const parsed = await callOpenAIJson({
    model,
    reasoningEffort: "medium",
    system,
    user,
  });

  if (!parsed) return buildFallbackReview(candidate);

  const decision = toSingleString(parsed.decision);
  const allowedDecision = new Set(["verified", "rejected", "conflict", "needs_review"]);
  if (!decision || !allowedDecision.has(decision)) {
    return buildFallbackReview(candidate);
  }

  const conflictFlags = Array.isArray(parsed.conflictFlags)
    ? parsed.conflictFlags.filter((entry): entry is string => typeof entry === "string")
    : [];

  const fieldScores: Record<string, number> = {};
  if (isObject(parsed.fieldScores)) {
    for (const [key, value] of Object.entries(parsed.fieldScores)) {
      const score = Number(value);
      if (!Number.isFinite(score)) continue;
      fieldScores[key] = Math.min(1, Math.max(0, score));
    }
  }

  const reviewerScoreRaw = Number(parsed.reviewerScore);
  const reviewerScore = Number.isFinite(reviewerScoreRaw)
    ? Math.min(1, Math.max(0, reviewerScoreRaw))
    : 0.5;

  return {
    decision: decision as ReviewedCandidate["decision"],
    conflictFlags,
    fieldScores,
    reviewerScore,
  };
}

async function getExistingProfiles(
  supabase: SupabaseClientLike,
): Promise<Map<string, { verified_at: string | null }>> {
  const { data, error } = await supabase
    .from("beach_profile_current")
    .select("beach_id, verified_at")
    .limit(5000);

  if (error || !Array.isArray(data)) return new Map();

  const rows: unknown[] = data;
  const map = new Map<string, { verified_at: string | null }>();
  for (const row of rows) {
    if (!isObject(row)) continue;
    const beachId = toSingleString(row.beach_id);
    if (!beachId) continue;
    map.set(beachId, { verified_at: toSingleString(row.verified_at) });
  }
  return map;
}

async function getProcessedToday(
  supabase: SupabaseClientLike,
  runDayRome: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("beach_enrichment_runs")
    .select("processed_count")
    .eq("run_day_rome", runDayRome)
    .limit(200);

  if (error || !Array.isArray(data)) return 0;
  const rows: unknown[] = data;
  let sum = 0;
  for (const row of rows) {
    if (!isObject(row)) continue;
    const value = Number(row.processed_count);
    if (!Number.isFinite(value)) continue;
    sum += value;
  }
  return sum;
}

async function getLastReviewRound(
  supabase: SupabaseClientLike,
  beachId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("beach_profile_candidates")
    .select("review_round")
    .eq("beach_id", beachId)
    .order("review_round", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !isObject(data)) return 0;
  const row = data as Record<string, unknown>;
  const value = Number(row.review_round);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

async function startRun(
  supabase: SupabaseClientLike,
  runDayRome: string,
  triggerSource: string,
  batchSize: number,
) {
  const { data, error } = await supabase
    .from("beach_enrichment_runs")
    .insert({
      trigger_source: triggerSource,
      status: "running",
      run_day_rome: runDayRome,
      batch_size: batchSize,
      started_at: new Date().toISOString(),
      notes: {},
    })
    .select("id")
    .single();

  if (error || !data || !isObject(data) || !toSingleString(data.id)) {
    return null;
  }

  const row = data as Record<string, unknown>;
  return toSingleString(row.id);
}

async function finishRun(
  supabase: SupabaseClientLike,
  runId: string,
  counters: RunCounters,
  status: "completed" | "failed",
  notes: Record<string, unknown>,
) {
  await supabase
    .from("beach_enrichment_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      processed_count: counters.processed,
      published_count: counters.published,
      queued_count: counters.queued,
      failed_count: counters.failed,
      notes,
    })
    .eq("id", runId);
}

async function queueCandidate(
  supabase: SupabaseClientLike,
  input: {
    beachId: string;
    candidateId: string;
    reason: string;
    priorityScore: number;
    conflictFlags: string[];
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("beach_profile_review_queue")
    .select("id, attempts")
    .eq("beach_id", input.beachId)
    .maybeSingle();

  const existing = data && isObject(data) ? data : null;
  if (existing && toSingleString(existing.id)) {
    const attempts = Number(existing.attempts);
    await supabase
      .from("beach_profile_review_queue")
      .update({
        candidate_id: input.candidateId,
        reason: input.reason,
        priority_score: input.priorityScore,
        conflict_flags: input.conflictFlags,
        attempts: Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts) + 1) : 1,
        last_attempt_at: nowIso,
        status: "pending",
        updated_at: nowIso,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("beach_profile_review_queue").insert({
    beach_id: input.beachId,
    candidate_id: input.candidateId,
    reason: input.reason,
    priority_score: input.priorityScore,
    conflict_flags: input.conflictFlags,
    attempts: 1,
    last_attempt_at: nowIso,
    status: "pending",
    created_at: nowIso,
    updated_at: nowIso,
  });
}

async function publishCurrentProfile(
  supabase: SupabaseClientLike,
  input: {
    beachId: string;
    candidate: ExtractedCandidate;
    confidence: number;
    fieldScores: Record<string, number>;
    reviewRound: number;
  },
) {
  const nowIso = new Date().toISOString();
  await supabase.from("beach_profile_current").upsert(
    {
      beach_id: input.beachId,
      hours: input.candidate.hours,
      services: input.candidate.services,
      phone: input.candidate.phone,
      website: input.candidate.website,
      price_band: input.candidate.priceBand,
      confidence: input.confidence,
      status: "published",
      source_primary_url: input.candidate.sourcePrimaryUrl,
      source_secondary_url: input.candidate.sourceSecondaryUrl,
      sources: input.candidate.fieldEvidence,
      field_scores: input.fieldScores,
      review_round: input.reviewRound,
      verified_at: nowIso,
      updated_at: nowIso,
    },
    {
      onConflict: "beach_id",
    },
  );
}

async function processBeach(
  supabase: SupabaseClientLike,
  runId: string,
  beach: BeachCatalogItem,
  config: {
    publishThreshold: number;
    maxReviewRounds: number;
  },
): Promise<{ outcome: "published" | "queued" | "failed"; reason?: string }> {
  const sources = await fetchSourceBundle(beach);
  const extracted = await runExtractionAgent(beach, sources);
  const reviewed = await runReviewAgent(beach, extracted, sources);
  const fieldScores = mergeFieldScores(extracted, reviewed);

  const confidenceResult = computePublishConfidence({
    hasOfficialSource: Boolean(extracted.sourcePrimaryUrl),
    hasGoogleSource: Boolean(sources.googleMapsUrl || sources.googleWebsite || sources.googlePhone),
    review: reviewed,
    threshold: config.publishThreshold,
  });

  const lastRound = await getLastReviewRound(supabase, beach.id);
  const nextRound = lastRound + 1;

  const candidatePayload = {
    beach,
    sources,
    extracted,
    reviewed,
  };

  const { data: insertedCandidate, error: candidateError } = await supabase
    .from("beach_profile_candidates")
    .insert({
      run_id: runId,
      beach_id: beach.id,
      candidate_payload: candidatePayload,
      field_evidence: extracted.fieldEvidence,
      review_decision: reviewed.decision,
      conflict_flags: reviewed.conflictFlags,
      field_scores: fieldScores,
      confidence: confidenceResult.confidence,
      review_round: nextRound,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (candidateError || !insertedCandidate || !isObject(insertedCandidate)) {
    return { outcome: "failed", reason: "candidate_insert_failed" };
  }

  const candidateId = toSingleString(insertedCandidate.id);
  if (!candidateId) {
    return { outcome: "failed", reason: "candidate_id_missing" };
  }

  const shouldPublish = confidenceResult.decision === "publish" && nextRound <= config.maxReviewRounds;
  if (shouldPublish) {
    await publishCurrentProfile(supabase, {
      beachId: beach.id,
      candidate: extracted,
      confidence: confidenceResult.confidence,
      fieldScores,
      reviewRound: nextRound,
    });
    return { outcome: "published" };
  }

  const reason = nextRound > config.maxReviewRounds ? "max_rounds_reached" : confidenceResult.reason;
  await queueCandidate(supabase, {
    beachId: beach.id,
    candidateId,
    reason,
    priorityScore: confidenceResult.confidence,
    conflictFlags: reviewed.conflictFlags,
  });

  return { outcome: "queued", reason };
}

async function runTestMode(
  req: VercelRequest,
  res: VercelResponse,
  catalog: BeachCatalogItem[],
): Promise<VercelResponse | void> {
  const runDayRome = getRomeDayKey();
  const dailyTarget = readIntEnv("BEACH_ENRICH_DAILY_TARGET", 40, 1, 400);
  const runCap = readIntEnv("BEACH_ENRICH_RUN_CAP", 10, 1, 100);
  const threshold = readNumberEnv("BEACH_PROFILE_PUBLISH_THRESHOLD", 0.85, 0.5, 0.99);
  const forceQueue = req.query.forceQueue === "1";

  const summary = updateTestModeStore(
    TEST_STORE_FILE,
    createTestStore,
    (store) => {
      const processedToday = store.runs
        .filter((run) => run.run_day_rome === runDayRome)
        .reduce((sum, run) => sum + run.processed_count, 0);

      const remaining = Math.max(0, dailyTarget - processedToday);
      const batchSize = Math.min(runCap, remaining);
      const runId = randomUUID();

      const run: TestRunRow = {
        id: runId,
        trigger_source: "cron",
        status: "running",
        run_day_rome: runDayRome,
        started_at: new Date().toISOString(),
        finished_at: null,
        batch_size: batchSize,
        processed_count: 0,
        published_count: 0,
        queued_count: 0,
        failed_count: 0,
        notes: {
          mode: "test",
        },
      };
      store.runs.push(run);

      const candidates = catalog
        .filter((beach) => !store.current[beach.id])
        .slice(0, batchSize);

      for (const beach of candidates) {
        const nowIso = new Date().toISOString();
        const candidate: ExtractedCandidate = normalizeCandidate({
          hours: "09:00 - 19:00",
          services: ["Ombrelloni", "Lettini", "Bar", "Docce"],
          phone: "+39 0541 123456",
          website: `https://${beach.id.toLowerCase()}.example.com`,
          priceBand: "mid",
          sourcePrimaryUrl: `https://${beach.id.toLowerCase()}.example.com`,
          sourceSecondaryUrl: `https://maps.google.com/?q=${encodeURIComponent(`${beach.name} ${beach.city}`)}`,
          fieldEvidence: [
            {
              field: "website",
              sourceType: "official",
              url: `https://${beach.id.toLowerCase()}.example.com`,
              snippet: "Fonte test ufficiale",
              observedAt: nowIso,
            },
          ],
        });

        const review: ReviewedCandidate = {
          decision: forceQueue ? "needs_review" : "verified",
          conflictFlags: forceQueue ? ["hours_conflict"] : [],
          fieldScores: {
            hours: forceQueue ? 0.62 : 0.9,
            services: 0.86,
            phone: 0.9,
            website: 0.92,
            priceBand: 0.84,
          },
          reviewerScore: forceQueue ? 0.7 : 0.92,
        };

        const confidenceResult = computePublishConfidence({
          hasOfficialSource: true,
          hasGoogleSource: true,
          review,
          threshold,
        });

        const candidateId = randomUUID();
        const reviewRound =
          store.candidates
            .filter((row) => row.beach_id === beach.id)
            .reduce((max, row) => Math.max(max, row.review_round), 0) + 1;

        store.candidates.push({
          id: candidateId,
          beach_id: beach.id,
          review_round: reviewRound,
          confidence: confidenceResult.confidence,
          review_decision: review.decision,
          conflict_flags: review.conflictFlags,
          field_scores: review.fieldScores,
          candidate_payload: {
            beach,
            candidate,
            review,
          },
          field_evidence: candidate.fieldEvidence,
          created_at: nowIso,
        });

        run.processed_count += 1;

        if (confidenceResult.decision === "publish") {
          store.current[beach.id] = {
            beach_id: beach.id,
            hours: candidate.hours,
            services: candidate.services,
            phone: candidate.phone,
            website: candidate.website,
            price_band: candidate.priceBand,
            confidence: confidenceResult.confidence,
            verified_at: nowIso,
            status: "published",
            sources: candidate.fieldEvidence,
          };
          run.published_count += 1;
        } else {
          const existingQueue = store.queue[beach.id];
          store.queue[beach.id] = {
            id: existingQueue?.id ?? randomUUID(),
            beach_id: beach.id,
            candidate_id: candidateId,
            reason: confidenceResult.reason,
            priority_score: confidenceResult.confidence,
            conflict_flags: review.conflictFlags,
            attempts: (existingQueue?.attempts ?? 0) + 1,
            last_attempt_at: nowIso,
            status: "pending",
            created_at: existingQueue?.created_at ?? nowIso,
            updated_at: nowIso,
          };
          run.queued_count += 1;
        }
      }

      run.status = "completed";
      run.finished_at = new Date().toISOString();

      return {
        runId,
        batchSize,
        processedToday,
        run,
      };
    },
  );

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    mode: "test",
    runId: summary.runId,
    batchSize: summary.batchSize,
    processedToday: summary.processedToday,
    processed: summary.run.processed_count,
    published: summary.run.published_count,
    queued: summary.run.queued_count,
    failed: summary.run.failed_count,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const auth = isAuthorized(req);
  if (auth.missingConfig) {
    return res.status(500).json({ ok: false, error: "missing_cron_secret" });
  }
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const catalog = await loadBeachCatalog();
  if (catalog.length === 0) {
    return res.status(500).json({ ok: false, error: "catalog_unavailable" });
  }

  if (TEST_MODE) {
    return runTestMode(req, res, catalog);
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const runDayRome = getRomeDayKey();
  const dailyTarget = readIntEnv("BEACH_ENRICH_DAILY_TARGET", 40, 1, 400);
  const runCap = readIntEnv("BEACH_ENRICH_RUN_CAP", 10, 1, 100);
  const refreshDays = readIntEnv("BEACH_ENRICH_REFRESH_DAYS", 30, 7, 180);
  const publishThreshold = readNumberEnv("BEACH_PROFILE_PUBLISH_THRESHOLD", 0.85, 0.5, 0.99);
  const maxReviewRounds = readIntEnv("BEACH_ENRICH_MAX_REVIEW_ROUNDS", 3, 1, 10);

  const processedToday = await getProcessedToday(supabase, runDayRome);
  if (processedToday >= dailyTarget) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: "daily_cap_reached",
      processedToday,
      dailyTarget,
    });
  }

  const remainingDaily = Math.max(0, dailyTarget - processedToday);
  const batchSize = Math.min(runCap, remainingDaily);

  const [overrides, signals, existingProfiles] = await Promise.all([
    loadPriorityOverrides(),
    loadSignalMaps(supabase),
    getExistingProfiles(supabase),
  ]);

  const priorities = buildPriorityList({
    catalog,
    overrides,
    cityWeightMap: cityWeights(catalog),
    analyticsMap: signals.analytics,
    favoritesMap: signals.favorites,
    reviewsMap: signals.reviews,
    existingProfiles,
    refreshDays,
  });

  const batch = priorities.slice(0, batchSize);
  if (batch.length === 0) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: "no_eligible_beaches",
      processedToday,
      dailyTarget,
    });
  }

  const triggerSource = req.query.manual === "1" ? "manual" : "cron";
  const runId = await startRun(supabase, runDayRome, triggerSource, batch.length);
  if (!runId) {
    return res.status(500).json({ ok: false, error: "run_start_failed" });
  }

  const counters: RunCounters = {
    processed: 0,
    published: 0,
    queued: 0,
    failed: 0,
  };

  const failures: Array<{ beachId: string; reason: string }> = [];

  try {
    for (const item of batch) {
      const result = await processBeach(supabase, runId, item.beach, {
        publishThreshold,
        maxReviewRounds,
      });
      counters.processed += 1;
      if (result.outcome === "published") counters.published += 1;
      else if (result.outcome === "queued") counters.queued += 1;
      else counters.failed += 1;

      if (result.outcome === "failed") {
        failures.push({
          beachId: item.beach.id,
          reason: result.reason ?? "unknown",
        });
      }
    }

    await finishRun(supabase, runId, counters, "completed", {
      failures,
      config: {
        publishThreshold,
        maxReviewRounds,
        refreshDays,
      },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      mode: "live",
      runId,
      batchSize: batch.length,
      processedToday,
      dailyTarget,
      processed: counters.processed,
      published: counters.published,
      queued: counters.queued,
      failed: counters.failed,
      failures,
    });
  } catch (error) {
    await finishRun(supabase, runId, counters, "failed", {
      failures,
      error: error instanceof Error ? error.message : "unknown_error",
    });

    return res.status(500).json({
      ok: false,
      error: "run_failed",
      runId,
      processed: counters.processed,
      published: counters.published,
      queued: counters.queued,
      failed: counters.failed,
    });
  }
}
