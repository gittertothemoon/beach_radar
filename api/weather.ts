import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_SECONDS = 900;
const MAX_NEXT_HOURS = 4;

type OpenMeteoPayload = {
  timezone?: string;
  current?: {
    time?: number;
    temperature_2m?: number;
    wind_speed_10m?: number;
    precipitation_probability?: number;
    weather_code?: number;
    is_day?: number;
  };
  hourly?: {
    time?: number[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
};

type WeatherHour = {
  ts: number;
  temperatureC: number;
  rainProbability: number | null;
  weatherCode: number;
};

function toQueryString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

function parseCoord(value: unknown, min: number, max: number): number | null {
  const raw = toQueryString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pickNextHours(
  hourly: OpenMeteoPayload["hourly"],
  currentTs: number,
): WeatherHour[] {
  if (!hourly) return [];
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const temperatures = Array.isArray(hourly.temperature_2m)
    ? hourly.temperature_2m
    : [];
  const rainProbabilities = Array.isArray(hourly.precipitation_probability)
    ? hourly.precipitation_probability
    : [];
  const weatherCodes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];

  const len = Math.min(
    times.length,
    temperatures.length,
    weatherCodes.length,
  );
  if (len <= 0) return [];

  const next: WeatherHour[] = [];
  for (let i = 0; i < len; i += 1) {
    const ts = times[i];
    const temperatureC = temperatures[i];
    const weatherCode = weatherCodes[i];
    const rainProbability = rainProbabilities[i];

    if (!isFiniteNumber(ts) || !isFiniteNumber(temperatureC) || !isFiniteNumber(weatherCode)) {
      continue;
    }

    if (ts < currentTs) continue;

    next.push({
      ts,
      temperatureC,
      rainProbability: isFiniteNumber(rainProbability) ? rainProbability : null,
      weatherCode,
    });

    if (next.length >= MAX_NEXT_HOURS) break;
  }

  return next;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const lat = parseCoord(req.query.lat, -90, 90);
  const lng = parseCoord(req.query.lng, -180, 180);

  if (lat === null || lng === null) {
    return res.status(400).json({ ok: false, error: "invalid_coords" });
  }

  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lng.toFixed(5),
    current:
      "temperature_2m,wind_speed_10m,precipitation_probability,weather_code,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    forecast_days: "2",
    timezone: "auto",
    timeformat: "unixtime",
  });

  let payload: OpenMeteoPayload;
  try {
    const upstream = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: "weather_upstream_failed" });
    }
    payload = (await upstream.json()) as OpenMeteoPayload;
  } catch {
    return res.status(502).json({ ok: false, error: "weather_upstream_error" });
  }

  const current = payload.current;
  if (!current) {
    return res.status(502).json({ ok: false, error: "weather_payload_invalid" });
  }

  const currentTs = current.time;
  const currentTemperature = current.temperature_2m;
  const currentWind = current.wind_speed_10m;
  const currentCode = current.weather_code;
  const currentRain = current.precipitation_probability;
  const currentIsDay = current.is_day;

  if (
    !isFiniteNumber(currentTs) ||
    !isFiniteNumber(currentTemperature) ||
    !isFiniteNumber(currentWind) ||
    !isFiniteNumber(currentCode)
  ) {
    return res.status(502).json({ ok: false, error: "weather_payload_invalid" });
  }

  const nextHours = pickNextHours(payload.hourly, currentTs);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_SECONDS * 1000);

  res.setHeader(
    "Cache-Control",
    `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
  );

  return res.status(200).json({
    ok: true,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    timezone: typeof payload.timezone === "string" ? payload.timezone : "Europe/Rome",
    current: {
      ts: currentTs,
      temperatureC: currentTemperature,
      windKmh: currentWind,
      rainProbability: isFiniteNumber(currentRain) ? currentRain : null,
      weatherCode: currentCode,
      isDay: currentIsDay === 1,
    },
    nextHours,
  });
}
