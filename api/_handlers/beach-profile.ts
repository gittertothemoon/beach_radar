import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readTestModeStore } from "./test-mode-store.js";
import { applyApiSecurityHeaders, readEnv } from "../_lib/security.js";

const CACHE_SECONDS = 300;
const TEST_MODE = process.env.BEACH_ENRICH_TEST_MODE === "1";
const TEST_STORE_FILE = "beach-enrichment-state.json";
const BEACH_ID_PATTERN = /^BR-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/;

type ProfileRow = {
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

type TestStoreState = {
  current: Record<string, ProfileRow>;
};

function createTestStore(): TestStoreState {
  return { current: {} };
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

function parseBeachId(value: unknown): string | null {
  const beachId = toSingleString(value);
  if (!beachId) return null;
  if (!BEACH_ID_PATTERN.test(beachId)) return null;
  return beachId;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseSources(value: unknown): Array<{ label: string; url: string; sourceType: string }> {
  if (!Array.isArray(value)) return [];
  const parsed: Array<{ label: string; url: string; sourceType: string }> = [];
  for (const item of value) {
    const record = asObject(item);
    if (!record) continue;
    const url = toSingleString(record.url);
    if (!url) continue;
    parsed.push({
      label: toSingleString(record.label) ?? "Fonte",
      url,
      sourceType: toSingleString(record.sourceType) ?? "source",
    });
  }
  return parsed;
}

function mapProfile(row: ProfileRow) {
  return {
    beachId: row.beach_id,
    hours: row.hours,
    services: Array.isArray(row.services) ? row.services.filter((entry) => typeof entry === "string") : [],
    phone: row.phone,
    website: row.website,
    priceBand: row.price_band ?? "unknown",
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    verifiedAt: row.verified_at,
    status: row.status ?? "published",
    sources: parseSources(row.sources),
  };
}

function createSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const beachId = parseBeachId(req.query.beachId);
  if (!beachId) {
    return res.status(400).json({ ok: false, error: "invalid_beach_id" });
  }

  res.setHeader(
    "Cache-Control",
    `public, max-age=3600, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`,
  );

  if (TEST_MODE) {
    const store = readTestModeStore(TEST_STORE_FILE, createTestStore);
    const row = store.current[beachId];
    return res.status(200).json({
      ok: true,
      profile: row ? mapProfile(row) : null,
      source: "test_mode",
    });
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const { data, error } = await supabase
    .from("beach_profile_current")
    .select(
      "beach_id, hours, services, phone, website, price_band, confidence, verified_at, status, sources",
    )
    .eq("beach_id", beachId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ ok: false, error: "db_read_failed" });
  }

  const row = data as ProfileRow | null;
  return res.status(200).json({
    ok: true,
    profile: row ? mapProfile(row) : null,
    source: "supabase",
  });
}
