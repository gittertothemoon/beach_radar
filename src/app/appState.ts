import type { CrowdLevel } from "../lib/types";
import type { LatLng } from "../lib/geo";

export const DEFAULT_CENTER: LatLng = { lat: 41.9028, lng: 12.4964 };
export const INITIAL_MAP_ZOOM = 9;
export const ITALY_BOUNDS: [[number, number], [number, number]] = [
  [35.3, 6.3],
  [47.3, 18.7],
];
export const BEACH_FOCUS_ZOOM = 17;
export const SHOW_ALL_PINS_ZOOM_TRIGGER = BEACH_FOCUS_ZOOM - 1;
export const SHOW_ALL_PINS_ZOOM_OUT_DELTA = 2;
export const SHOW_ALL_PINS_FLY_DURATION_S = 1.1;
export const REPORT_RADIUS_M = 700;
export const REPORTS_FEED_ERROR_TOAST_GRACE_MS = 10_000;
export const LIMITED_DATA_SHOW_THRESHOLD = 0.9;
export const LIMITED_DATA_HIDE_THRESHOLD = 0.8;
export const REMOTE_REPORT_SESSION_KEY = "br_report_anywhere_v1";
export const REGISTER_RESUME_KEY = "where2beach-register-resume-v1";
export const MOCK_CROWD_LEVELS: CrowdLevel[] = [1, 2, 3, 4];
export const LOCATION_FOCUS_ZOOM = 16;
export const LOCATION_REFRESH_MS = 15_000;
export const NEARBY_RADIUS_M = 15_000;
export const BOTTOM_NAV_FALLBACK_HEIGHT_PX = 76;
export const BEACH_PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
export const PUBLIC_FALLBACK_AUTHOR_NAME = "Utente";

export type RegisterResumeMapView = {
  lat: number;
  lng: number;
  zoom: number;
};

export type RegisterResumeSnapshot = {
  search: string;
  selectedBeachId: string | null;
  soloBeachId: string | null;
  isLidoModalOpen: boolean;
  sheetOpen: boolean;
  reportOpen: boolean;
  mapView: RegisterResumeMapView | null;
};

export const weatherCacheKey = (lat: number, lng: number) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}`;

const parseBooleanFlag = (value: string | null): boolean | null => {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return null;
};

export const readQueryBooleanFlag = (
  searchParams: URLSearchParams,
  ...keys: string[]
): boolean | null => {
  for (const key of keys) {
    const parsed = parseBooleanFlag(searchParams.get(key));
    if (parsed !== null) return parsed;
  }
  return null;
};

export const consumeRegisterResumeSnapshot = (): RegisterResumeSnapshot | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("resume") !== "1") return null;

  const raw = window.sessionStorage.getItem(REGISTER_RESUME_KEY);
  window.sessionStorage.removeItem(REGISTER_RESUME_KEY);

  params.delete("resume");
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RegisterResumeSnapshot>;
    const mapView =
      parsed.mapView &&
        typeof parsed.mapView === "object" &&
        typeof parsed.mapView.lat === "number" &&
        Number.isFinite(parsed.mapView.lat) &&
        typeof parsed.mapView.lng === "number" &&
        Number.isFinite(parsed.mapView.lng) &&
        typeof parsed.mapView.zoom === "number" &&
        Number.isFinite(parsed.mapView.zoom)
        ? {
          lat: parsed.mapView.lat,
          lng: parsed.mapView.lng,
          zoom: parsed.mapView.zoom,
        }
        : null;

    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedBeachId:
        typeof parsed.selectedBeachId === "string" ? parsed.selectedBeachId : null,
      soloBeachId: typeof parsed.soloBeachId === "string" ? parsed.soloBeachId : null,
      isLidoModalOpen: parsed.isLidoModalOpen === true,
      sheetOpen: parsed.sheetOpen === true,
      reportOpen: parsed.reportOpen === true,
      mapView,
    };
  } catch {
    return null;
  }
};
