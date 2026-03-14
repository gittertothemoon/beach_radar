import { buildApiUrl } from "../config/env";
import { weatherConditionLabel, windDirectionLabel } from "../lib/labels";
import type { WeatherSnapshot } from "../types/domain";
import { apiFetchJson } from "./http";

type WeatherApiPayload = {
  ok: true;
  fetchedAt: string;
  expiresAt: string;
  timezone: string;
  current: {
    ts: number;
    temperatureC: number;
    windKmh: number;
    windDirectionDeg: number | null;
    rainProbability: number | null;
    weatherCode: number;
    isDay: boolean;
  };
  nextHours: Array<{
    ts: number;
    temperatureC: number;
    rainProbability: number | null;
    weatherCode: number;
  }>;
};

type FetchWeatherErrorCode = "network" | "timeout" | "unavailable" | "invalid_payload";

export type FetchWeatherResult =
  | { ok: true; weather: WeatherSnapshot }
  | { ok: false; code: FetchWeatherErrorCode };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toOptionalFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const parseWeatherPayload = (value: unknown): WeatherSnapshot | null => {
  if (!isObject(value) || value.ok !== true) return null;
  const current = value.current;
  const nextHours = value.nextHours;
  if (!isObject(current) || !Array.isArray(nextHours)) return null;

  const fetchedAt = Date.parse(String(value.fetchedAt || ""));
  const expiresAt = Date.parse(String(value.expiresAt || ""));
  const timezone =
    typeof value.timezone === "string" && value.timezone.trim().length > 0
      ? value.timezone
      : "Europe/Rome";

  const currentTs = toFiniteNumber(current.ts);
  const currentTemp = toFiniteNumber(current.temperatureC);
  const currentWind = toFiniteNumber(current.windKmh);
  const currentCode = toFiniteNumber(current.weatherCode);
  const currentWindDir = toOptionalFiniteNumber(current.windDirectionDeg);
  const currentRain = toOptionalFiniteNumber(current.rainProbability);

  if (
    !Number.isFinite(fetchedAt) ||
    !Number.isFinite(expiresAt) ||
    currentTs === null ||
    currentTemp === null ||
    currentWind === null ||
    currentCode === null
  ) {
    return null;
  }

  const parsedNextHours: WeatherSnapshot["nextHours"] = [];
  for (const row of nextHours) {
    if (!isObject(row)) continue;
    const ts = toFiniteNumber(row.ts);
    const temperatureC = toFiniteNumber(row.temperatureC);
    const weatherCode = toFiniteNumber(row.weatherCode);
    const rainProbability = toOptionalFiniteNumber(row.rainProbability);
    if (ts === null || temperatureC === null || weatherCode === null) continue;
    parsedNextHours.push({
      ts,
      temperatureC,
      rainProbability,
      weatherCode,
      conditionLabel: weatherConditionLabel(weatherCode),
    });
    if (parsedNextHours.length >= 4) break;
  }

  return {
    fetchedAt,
    expiresAt,
    timezone,
    current: {
      ts: currentTs,
      temperatureC: currentTemp,
      windKmh: currentWind,
      windDirectionDeg: currentWindDir,
      windDirectionLabel: windDirectionLabel(currentWindDir),
      rainProbability: currentRain,
      weatherCode: currentCode,
      conditionLabel: weatherConditionLabel(currentCode),
    },
    nextHours: parsedNextHours,
  };
};

export const fetchBeachWeather = async (
  lat: number,
  lng: number,
): Promise<FetchWeatherResult> => {
  const result = await apiFetchJson<WeatherApiPayload>(
    buildApiUrl("/weather", {
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    }),
    {
      method: "GET",
    },
  );

  if (!result.ok) return { ok: false, code: result.code };

  const weather = parseWeatherPayload(result.data);
  if (!weather) return { ok: false, code: "invalid_payload" };

  return { ok: true, weather };
};
