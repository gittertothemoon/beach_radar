import {
  REGISTER_RESUME_KEY,
  type RegisterResumeSnapshot,
} from "./appState";

export type RegisterNavigationOptions = {
  favoriteBeachId?: string | null;
  beachName?: string | null;
  authMode?: "login" | "register";
};

type BuildRegisterResumeSnapshotInput = Omit<RegisterResumeSnapshot, "mapView"> & {
  mapCenter?: { lat: number; lng: number } | null;
  mapZoom?: number | null;
};

export const buildRegisterResumeSnapshot = (
  input: BuildRegisterResumeSnapshotInput,
): RegisterResumeSnapshot => {
  const mapView =
    input.mapCenter &&
    typeof input.mapZoom === "number" &&
    Number.isFinite(input.mapZoom)
      ? { lat: input.mapCenter.lat, lng: input.mapCenter.lng, zoom: input.mapZoom }
      : null;

  return {
    search: input.search,
    selectedBeachId: input.selectedBeachId,
    soloBeachId: input.soloBeachId,
    isLidoModalOpen: input.isLidoModalOpen,
    sheetOpen: input.sheetOpen,
    reportOpen: input.reportOpen,
    mapView,
  };
};

export const persistRegisterResumeSnapshot = (
  snapshot: RegisterResumeSnapshot,
): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REGISTER_RESUME_KEY, JSON.stringify(snapshot));
};

export const buildRegisterRedirectUrl = (
  returnTo: string,
  options?: RegisterNavigationOptions,
): string => {
  const params = new URLSearchParams({ returnTo });
  if (options?.favoriteBeachId) params.set("fav", options.favoriteBeachId);
  if (options?.beachName) params.set("beachName", options.beachName);
  if (options?.authMode === "login") params.set("mode", "login");
  return `/register?${params.toString()}`;
};
