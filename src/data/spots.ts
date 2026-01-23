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
};

export type Spot = Beach & {
  city?: string;
  province?: string;
  baselineSource?: string;
  notes?: string;
  rawRegion?: string;
};

const parseCoord = (value: SeedSpot["lat"]) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
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
});

export const SPOTS: Spot[] = (rawSpots as SeedSpot[]).map(normalizeSpot);
