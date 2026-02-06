import { STRINGS } from "../i18n/it";

export type BeachWeatherCurrent = {
  ts: number;
  temperatureC: number;
  windKmh: number;
  rainProbability: number | null;
  weatherCode: number;
  isDay: boolean;
  conditionLabel: string;
};

export type BeachWeatherHour = {
  ts: number;
  temperatureC: number;
  rainProbability: number | null;
  weatherCode: number;
  conditionLabel: string;
};

export type BeachWeatherSnapshot = {
  fetchedAt: number;
  expiresAt: number;
  timezone: string;
  current: BeachWeatherCurrent;
  nextHours: BeachWeatherHour[];
};

type WeatherApiSuccess = {
  ok: true;
  fetchedAt: string;
  expiresAt: string;
  timezone: string;
  current: {
    ts: number;
    temperatureC: number;
    windKmh: number;
    rainProbability: number | null;
    weatherCode: number;
    isDay: boolean;
  };
  nextHours: {
    ts: number;
    temperatureC: number;
    rainProbability: number | null;
    weatherCode: number;
  }[];
};

type WeatherApiError = {
  ok: false;
  error: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const toOptionalFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const weatherConditionLabel = (code: number) => {
  if (code === 0) return STRINGS.weather.conditions.clear;
  if (code === 1) return STRINGS.weather.conditions.mainlyClear;
  if (code === 2) return STRINGS.weather.conditions.cloudy;
  if (code === 3) return STRINGS.weather.conditions.overcast;
  if (code === 45 || code === 48) return STRINGS.weather.conditions.fog;
  if (code >= 51 && code <= 57) return STRINGS.weather.conditions.drizzle;
  if (code >= 61 && code <= 67) return STRINGS.weather.conditions.rain;
  if (code >= 71 && code <= 77) return STRINGS.weather.conditions.snow;
  if (code >= 80 && code <= 82) return STRINGS.weather.conditions.showers;
  if (code >= 95 && code <= 99) return STRINGS.weather.conditions.thunder;
  return STRINGS.weather.conditions.unknown;
};

const parseApiSuccess = (payload: unknown): BeachWeatherSnapshot => {
  if (!isObject(payload) || payload.ok !== true) {
    throw new Error("invalid_weather_payload");
  }

  const currentRaw = payload.current;
  const nextHoursRaw = payload.nextHours;
  if (!isObject(currentRaw) || !Array.isArray(nextHoursRaw)) {
    throw new Error("invalid_weather_payload");
  }

  const fetchedAtMs = Date.parse(String(payload.fetchedAt || ""));
  const expiresAtMs = Date.parse(String(payload.expiresAt || ""));
  const timezone =
    typeof payload.timezone === "string" && payload.timezone.trim().length > 0
      ? payload.timezone
      : "Europe/Rome";

  const currentTs = toFiniteNumber(currentRaw.ts);
  const currentTemp = toFiniteNumber(currentRaw.temperatureC);
  const currentWind = toFiniteNumber(currentRaw.windKmh);
  const currentCode = toFiniteNumber(currentRaw.weatherCode);
  const currentRain = toOptionalFiniteNumber(currentRaw.rainProbability);
  const isDay = currentRaw.isDay === true;

  if (
    !Number.isFinite(fetchedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    currentTs === null ||
    currentTemp === null ||
    currentWind === null ||
    currentCode === null
  ) {
    throw new Error("invalid_weather_payload");
  }

  const nextHours: BeachWeatherHour[] = [];
  for (const entry of nextHoursRaw) {
    if (!isObject(entry)) continue;
    const ts = toFiniteNumber(entry.ts);
    const temperatureC = toFiniteNumber(entry.temperatureC);
    const weatherCode = toFiniteNumber(entry.weatherCode);
    const rainProbability = toOptionalFiniteNumber(entry.rainProbability);
    if (ts === null || temperatureC === null || weatherCode === null) {
      continue;
    }
    nextHours.push({
      ts,
      temperatureC,
      rainProbability,
      weatherCode,
      conditionLabel: weatherConditionLabel(weatherCode),
    });
    if (nextHours.length >= 4) break;
  }

  return {
    fetchedAt: fetchedAtMs,
    expiresAt: expiresAtMs,
    timezone,
    current: {
      ts: currentTs,
      temperatureC: currentTemp,
      windKmh: currentWind,
      rainProbability: currentRain,
      weatherCode: currentCode,
      isDay,
      conditionLabel: weatherConditionLabel(currentCode),
    },
    nextHours,
  };
};

export const formatWeatherHour = (ts: number, timezone: string) => {
  const date = new Date(ts * 1000);
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
};

export const fetchBeachWeather = async (
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<BeachWeatherSnapshot> => {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
  });

  const response = await fetch(`/api/weather?${params.toString()}`, { signal });
  const payload = (await response.json()) as WeatherApiSuccess | WeatherApiError;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error("weather_fetch_failed");
  }

  return parseApiSuccess(payload);
};
