import { createClient } from "@supabase/supabase-js";
import { readEnv } from "../_lib/security.js";
import { getActiveAnomaly, loadAllTimePatterns } from "./ml-engine.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const BEACH_REPORTS_TABLE = "beach_reports";
const PREDICTIONS_TABLE = "crowd_predictions";

// Fixed Italian public holidays: [month 1-12, day 1-31]
const ITALIAN_HOLIDAYS: Array<{ m: number; d: number }> = [
  { m: 1, d: 1 },   // Capodanno
  { m: 1, d: 6 },   // Epifania
  { m: 4, d: 25 },  // Festa della Liberazione
  { m: 5, d: 1 },   // Festa del Lavoro
  { m: 6, d: 2 },   // Festa della Repubblica
  { m: 8, d: 15 },  // Ferragosto
  { m: 11, d: 1 },  // Tutti i Santi
  { m: 12, d: 8 },  // Immacolata Concezione
  { m: 12, d: 25 }, // Natale
  { m: 12, d: 26 }, // Santo Stefano
];

export type PredictionFactors = {
  baseline: number;
  weekendBonus: boolean;
  holidayBonus: boolean;
  seasonBonus: boolean;
  tempModifier: number;
  rainModifier: number;
  windModifier: number;
  realtimeTrend: number;
};

export type HourlyPrediction = {
  targetTime: string;
  crowdIndex: number;
  confidence: number;
  factors: PredictionFactors;
};

type WeatherForecastHour = {
  tsMs: number;
  tempC: number;
  rainProb: number;
  windKmh: number;
};

export function buildSupabaseClient() {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
}

function crowdLevelToIndex(level: number): number {
  return Math.round((level - 0.5) * 25);
}

function isItalianHoliday(date: Date): boolean {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return ITALIAN_HOLIDAYS.some((h) => h.m === m && h.d === d);
}

function isHighSeason(date: Date): boolean {
  const m = date.getUTCMonth() + 1;
  return m >= 6 && m <= 9;
}

function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

async function fetchHourlyForecast(
  lat: number,
  lng: number,
): Promise<WeatherForecastHour[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lng.toFixed(5),
    hourly: "temperature_2m,precipitation_probability,wind_speed_10m",
    forecast_days: "2",
    timezone: "auto",
    timeformat: "unixtime",
  });

  try {
    const res = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      hourly?: {
        time?: number[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
        wind_speed_10m?: number[];
      };
    };

    const times = Array.isArray(data.hourly?.time) ? data.hourly!.time! : [];
    const temps = Array.isArray(data.hourly?.temperature_2m) ? data.hourly!.temperature_2m! : [];
    const rain = Array.isArray(data.hourly?.precipitation_probability) ? data.hourly!.precipitation_probability! : [];
    const wind = Array.isArray(data.hourly?.wind_speed_10m) ? data.hourly!.wind_speed_10m! : [];

    const len = Math.min(times.length, temps.length);
    const result: WeatherForecastHour[] = [];
    for (let i = 0; i < len; i++) {
      const tsMs = times[i] * 1000;
      const tempC = temps[i];
      if (!Number.isFinite(tsMs) || !Number.isFinite(tempC)) continue;
      result.push({
        tsMs,
        tempC,
        rainProb: Number.isFinite(rain[i]) ? rain[i] : 0,
        windKmh: Number.isFinite(wind[i]) ? wind[i] : 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}

function findWeatherForHour(
  forecast: WeatherForecastHour[],
  targetMs: number,
): WeatherForecastHour | null {
  let best: WeatherForecastHour | null = null;
  let bestDiff = Infinity;
  for (const entry of forecast) {
    const diff = Math.abs(entry.tsMs - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return bestDiff <= 90 * 60 * 1000 ? best : null;
}

function computeWeatherModifiers(weather: WeatherForecastHour | null): {
  tempModifier: number;
  rainModifier: number;
  windModifier: number;
} {
  if (!weather) return { tempModifier: 0, rainModifier: 0, windModifier: 0 };

  let tempModifier = 0;
  if (weather.tempC > 30) tempModifier = 0.1;
  else if (weather.tempC >= 25) tempModifier = 0.05;
  else if (weather.tempC < 20) tempModifier = -0.15;

  let rainModifier = 0;
  if (weather.rainProb >= 50) rainModifier = -0.3;
  else if (weather.rainProb >= 20) rainModifier = -0.15;

  let windModifier = 0;
  if (weather.windKmh > 30) windModifier = -0.15;
  else if (weather.windKmh > 20) windModifier = -0.08;

  return { tempModifier, rainModifier, windModifier };
}

export async function computePredictions(
  beachId: string,
  lat: number | null,
  lng: number | null,
  hours: number,
  supabase: ReturnType<typeof buildSupabaseClient>,
): Promise<HourlyPrediction[]> {
  if (!supabase) return [];

  const now = new Date();

  // Build target hour list: next `hours` whole hours
  const targetTimes: Date[] = [];
  for (let h = 1; h <= hours; h++) {
    const t = new Date(now);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getUTCHours() + h);
    targetTimes.push(t);
  }

  // Fetch weather forecast (skip if no coords)
  const forecast = lat !== null && lng !== null
    ? await fetchHourlyForecast(lat, lng)
    : [];

  // Fetch recent reports (last 4h) for real-time trend correction
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const { data: recentRaw } = await supabase
    .from(BEACH_REPORTS_TABLE)
    .select("crowd_level, created_at")
    .eq("beach_id", beachId)
    .gte("created_at", fourHoursAgo)
    .order("created_at", { ascending: false });

  const recentReports = Array.isArray(recentRaw) ? recentRaw : [];
  const twoHoursAgoMs = now.getTime() - 2 * 60 * 60 * 1000;
  const recent0to2 = recentReports.filter((r) => Date.parse(r.created_at) >= twoHoursAgoMs);
  const recent2to4 = recentReports.filter((r) => Date.parse(r.created_at) < twoHoursAgoMs);

  const avgIndex = (arr: typeof recentReports) =>
    arr.length === 0
      ? null
      : arr.reduce((s, r) => s + crowdLevelToIndex(r.crowd_level), 0) / arr.length;

  const avg0to2 = avgIndex(recent0to2);
  const avg2to4 = avgIndex(recent2to4);

  let realtimeTrend = 1.0;
  if (avg0to2 !== null && avg2to4 !== null && avg2to4 > 0) {
    if (avg0to2 > avg2to4 * 1.1) realtimeTrend = 1.1;
    else if (avg0to2 < avg2to4 * 0.9) realtimeTrend = 0.9;
  }

  const hasRecentData = recent0to2.length > 0;

  // Phase 4: load time patterns and check for active anomaly in parallel
  const [timePatterns, activeAnomaly] = await Promise.all([
    loadAllTimePatterns(beachId, supabase),
    getActiveAnomaly(beachId, supabase),
  ]);

  // Anomaly boosts or dampens the trend depending on z-score direction
  if (activeAnomaly) {
    const anomalyFactor = activeAnomaly.zScore > 0 ? 1.2 : 0.8;
    realtimeTrend = Math.min(1.3, Math.max(0.7, realtimeTrend * anomalyFactor));
  }

  // Fetch historical reports (up to 1 year, older than 6h) in a single query
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

  const { data: historicalRaw } = await supabase
    .from(BEACH_REPORTS_TABLE)
    .select("crowd_level, created_at")
    .eq("beach_id", beachId)
    .gte("created_at", oneYearAgo)
    .lt("created_at", sixHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1000);

  const allHistorical = Array.isArray(historicalRaw) ? historicalRaw : [];

  // Pre-parse dates for efficiency
  const parsedHistorical = allHistorical.map((r) => ({
    crowdLevel: r.crowd_level as number,
    tsMs: Date.parse(r.created_at),
    dow: new Date(r.created_at).getUTCDay(),
    month: new Date(r.created_at).getUTCMonth() + 1,
    hour: new Date(r.created_at).getUTCHours(),
  }));

  const predictions: HourlyPrediction[] = [];

  for (const targetDate of targetTimes) {
    const targetDow = targetDate.getUTCDay();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetHour = targetDate.getUTCHours();
    const hourMin = Math.max(0, targetHour - 2);
    const hourMax = Math.min(23, targetHour + 2);

    // Filter historical for similar conditions
    const similar = parsedHistorical.filter(
      (r) =>
        r.dow === targetDow &&
        r.month === targetMonth &&
        r.hour >= hourMin &&
        r.hour <= hourMax,
    );

    // Fase A: baseline (weighted by recency, 30-day half-life)
    let baseline = 50;
    if (similar.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      const nowMs = now.getTime();
      for (const r of similar) {
        const ageDays = (nowMs - r.tsMs) / (1000 * 60 * 60 * 24);
        const weight = Math.exp(-ageDays / 30);
        weightedSum += crowdLevelToIndex(r.crowdLevel) * weight;
        totalWeight += weight;
      }
      baseline = totalWeight > 0 ? weightedSum / totalWeight : 50;
    }

    // Phase 4: blend with precomputed time-series pattern when historical data is sparse
    const patternKey = `${targetDow}:${targetHour}`;
    const pattern = timePatterns.get(patternKey);
    if (pattern) {
      const patternIndex = crowdLevelToIndex(pattern.avgCrowdLevel);
      if (similar.length === 0) {
        // No historical — use pattern directly
        baseline = patternIndex;
      } else if (similar.length < 5) {
        // Blend: more weight to pattern as historical count drops
        const patternWeight = (5 - similar.length) / 5 * 0.6;
        baseline = baseline * (1 - patternWeight) + patternIndex * patternWeight;
      }
    }

    // Fase B: contextual modifiers
    const weekendBonus = isWeekend(targetDate);
    const holidayBonus = isItalianHoliday(targetDate);
    const seasonBonus = isHighSeason(targetDate);

    const weather = findWeatherForHour(forecast, targetDate.getTime());
    const { tempModifier, rainModifier, windModifier } = computeWeatherModifiers(weather);

    const totalModifier =
      (weekendBonus ? 0.15 : 0) +
      (holidayBonus ? 0.2 : 0) +
      (seasonBonus ? 0.1 : 0) +
      tempModifier +
      rainModifier +
      windModifier;

    // Fase C: real-time trend correction
    let adjusted = baseline * (1 + totalModifier) * realtimeTrend;
    const crowdIndex = Math.round(Math.min(100, Math.max(0, adjusted)));

    // Confidence: based on similar-condition report count
    const histCount = similar.length;
    let confidence = 0.3;
    if (histCount >= 20) confidence = 0.9;
    else if (histCount >= 10) confidence = 0.7;
    else if (histCount >= 5) confidence = 0.5;
    if (hasRecentData) confidence = Math.min(1.0, confidence + 0.1);
    // Phase 4: time pattern adds confidence when historical data is sparse
    if (pattern && pattern.sampleCount >= 10 && histCount < 5) {
      confidence = Math.min(1.0, confidence + 0.15);
    }

    predictions.push({
      targetTime: targetDate.toISOString(),
      crowdIndex,
      confidence,
      factors: {
        baseline: Math.round(baseline),
        weekendBonus,
        holidayBonus,
        seasonBonus,
        tempModifier,
        rainModifier,
        windModifier,
        realtimeTrend,
      },
    });
  }

  return predictions;
}

export async function getCachedPredictions(
  beachId: string,
  targetTimes: Date[],
  supabase: ReturnType<typeof buildSupabaseClient>,
): Promise<Map<string, HourlyPrediction>> {
  if (!supabase) return new Map();

  const now = new Date().toISOString();
  const targetIsos = targetTimes.map((t) => t.toISOString());

  const { data } = await supabase
    .from(PREDICTIONS_TABLE)
    .select("target_time, crowd_index, confidence, factors_json")
    .eq("beach_id", beachId)
    .in("target_time", targetIsos)
    .gt("valid_until", now);

  const cached = new Map<string, HourlyPrediction>();
  if (!Array.isArray(data)) return cached;

  for (const row of data) {
    cached.set(row.target_time as string, {
      targetTime: row.target_time as string,
      crowdIndex: row.crowd_index as number,
      confidence: row.confidence as number,
      factors: (row.factors_json ?? {}) as PredictionFactors,
    });
  }
  return cached;
}

export async function cachePredictions(
  beachId: string,
  predictions: HourlyPrediction[],
  nowMs: number,
  supabase: ReturnType<typeof buildSupabaseClient>,
): Promise<void> {
  if (!supabase || predictions.length === 0) return;

  const rows = predictions.map((p) => {
    const targetMs = Date.parse(p.targetTime);
    const hoursAhead = (targetMs - nowMs) / (1000 * 60 * 60);
    // Short-term (≤2h): 15 min TTL; medium-term: 60 min TTL
    const ttlMs = hoursAhead <= 2 ? 15 * 60 * 1000 : 60 * 60 * 1000;
    return {
      beach_id: beachId,
      target_time: p.targetTime,
      crowd_index: p.crowdIndex,
      confidence: p.confidence,
      factors_json: p.factors,
      valid_until: new Date(nowMs + ttlMs).toISOString(),
    };
  });

  await supabase
    .from(PREDICTIONS_TABLE)
    .upsert(rows, { onConflict: "beach_id,target_time" });
}

export async function pruneExpiredPredictions(
  supabase: ReturnType<typeof buildSupabaseClient>,
): Promise<number> {
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from(PREDICTIONS_TABLE)
    .delete({ count: "exact" })
    .lt("valid_until", new Date().toISOString());

  if (error) return 0;
  return count ?? 0;
}
