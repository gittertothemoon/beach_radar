import type { Beach } from "../lib/types";
import rawSpots from "./BeachRadar_Riviera_30_geocoded.json";

type SeedSpot = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  region?: string;
  baselineLevel?: number;
  baselineSource?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  notes?: string;
  status?: "pilot" | "draft" | "inactive";
};

export type Spot = Beach & {
  city?: string;
  province?: string;
  baselineSource?: string;
  notes?: string;
  rawRegion?: string;
  status?: "pilot" | "draft" | "inactive";
};

const parseCoord = (value: SeedSpot["lat"]) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

const normalizeStatus = (value: SeedSpot["status"]) => {
  if (value === "pilot" || value === "draft" || value === "inactive") {
    return value;
  }
  return "pilot";
};

const normalizeSpot = (spot: SeedSpot): Spot => ({
  id: spot.id,
  name: spot.name,
  region: spot.city ?? spot.region ?? "",
  city: spot.city,
  province: spot.province,
  rawRegion: spot.region,
  address: spot.address,
  baselineLevel: spot.baselineLevel as Beach["baselineLevel"],
  baselineSource: spot.baselineSource,
  notes: spot.notes,
  lat: parseCoord(spot.lat),
  lng: parseCoord(spot.lng),
  status: normalizeStatus(spot.status),
});

export const SPOTS: Spot[] = (rawSpots as SeedSpot[])
  .map(normalizeSpot)
  .filter((spot) => spot.status !== "inactive");
