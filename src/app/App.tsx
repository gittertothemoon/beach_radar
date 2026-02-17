import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import MapView from "../components/MapView";
import TopSearch from "../components/TopSearch";
import BottomSheet from "../components/BottomSheet";
import WeatherWidget from "../components/WeatherWidget";
import logo from "../assets/logo.png";
import logoText from "../assets/beach-radar-scritta.png";
import splashBg from "../assets/initial-bg.png";
import { SPOTS, hasFiniteCoords } from "../data/spots";
import { STRINGS } from "../i18n/it";
import {
  aggregateBeachStatsFromIndex,
  buildReportsIndex,
} from "../lib/aggregate";
import { distanceInMeters } from "../lib/geo";
import {
  clearOverride,
  clearOverrides,
  loadOverrides,
  setOverride,
} from "../lib/overrides";
import {
  formatConfidence,
  formatMinutesAgo,
} from "../lib/format";
import {
  deleteCurrentAccount,
  loadFavoriteBeachIds,
  setFavoriteBeach,
  signOutAccount,
  subscribeAccountChanges,
  getCurrentAccount,
  type AppAccount,
} from "../lib/account";
import { getReporterHash } from "../lib/storage";
import {
  ANALYTICS_UPDATE_EVENT,
  type AnalyticsSource,
  clearEvents,
  loadEvents,
  track,
} from "../lib/analytics";
import {
  ATTRIBUTION_UPDATE_EVENT,
  clearAttribution,
  extractAttributionParams,
  loadAttribution,
  upsertAttribution,
} from "../lib/attribution";
import {
  clearPerfStats,
  getPerfSnapshot,
  subscribePerf,
  useRenderCounter,
} from "../lib/perf";
import {
  fetchBeachWeather,
  type BeachWeatherSnapshot,
} from "../lib/weather";
import { fetchSharedReports, submitSharedReport } from "../lib/reports";
import type { BeachWithStats, CrowdLevel, Report } from "../lib/types";
import type { LatLng, UserLocation } from "../lib/geo";
import type { BeachOverrides } from "../lib/overrides";
import { FEATURE_FLAGS } from "../config/features";

const LidoModalCard = lazy(() => import("../components/LidoModalCard"));
const ReportModal = lazy(() => import("../components/ReportModal"));
const ReportThanksModal = lazy(() => import("../components/ReportThanksModal"));
const PerformanceOverlay = lazy(() => import("../components/PerformanceOverlay"));
const AccountRequiredModal = lazy(() => import("../components/AccountRequiredModal"));
const ProfileModal = lazy(() => import("../components/ProfileModal"));

const DEFAULT_CENTER: LatLng = { lat: 41.9028, lng: 12.4964 };
const INITIAL_MAP_ZOOM = 6;
const ITALY_BOUNDS: [[number, number], [number, number]] = [
  [35.3, 6.3],
  [47.3, 18.7],
];
const BEACH_FOCUS_ZOOM = 17;
const SHOW_ALL_PINS_ZOOM_TRIGGER = BEACH_FOCUS_ZOOM - 1;
const SHOW_ALL_PINS_ZOOM_OUT_DELTA = 2;
const SHOW_ALL_PINS_FLY_DURATION_S = 1.1;
const REPORT_RADIUS_M = 700;
const REPORTS_FEED_ERROR_TOAST_GRACE_MS = 10_000;
const REMOTE_REPORT_SESSION_KEY = "br_report_anywhere_v1";
const REGISTER_RESUME_KEY = "beach-radar-register-resume-v1";
const MOCK_CROWD_LEVELS: CrowdLevel[] = [1, 2, 3, 4];
const LOCATION_FOCUS_ZOOM = 16;
const LOCATION_REFRESH_MS = 15_000;
const NEARBY_RADIUS_M = 15_000;

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "error";
type WeatherStatus = "loading" | "ready" | "error";
type ToastTone = "info" | "success" | "error";

type WeatherCacheEntry = {
  status: WeatherStatus;
  data: BeachWeatherSnapshot | null;
  expiresAt: number;
};

type RegisterResumeMapView = {
  lat: number;
  lng: number;
  zoom: number;
};

type RegisterResumeSnapshot = {
  search: string;
  selectedBeachId: string | null;
  soloBeachId: string | null;
  isLidoModalOpen: boolean;
  sheetOpen: boolean;
  reportOpen: boolean;
  mapView: RegisterResumeMapView | null;
};

const weatherCacheKey = (lat: number, lng: number) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}`;

const parseBooleanFlag = (value: string | null): boolean | null => {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return null;
};

const readQueryBooleanFlag = (
  searchParams: URLSearchParams,
  ...keys: string[]
): boolean | null => {
  for (const key of keys) {
    const parsed = parseBooleanFlag(searchParams.get(key));
    if (parsed !== null) return parsed;
  }
  return null;
};

const consumeRegisterResumeSnapshot = (): RegisterResumeSnapshot | null => {
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

function App() {
  const registerResumeSnapshot = useMemo(() => consumeRegisterResumeSnapshot(), []);
  const [search, setSearch] = useState(() => registerResumeSnapshot?.search ?? "");
  const [reports, setReports] = useState<Report[]>([]);
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [favoriteBeachIds, setFavoriteBeachIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set<string>() : new Set(),
  );
  const [now, setNow] = useState(Date.now);
  const [overrides, setOverrides] = useState<BeachOverrides>(() =>
    typeof window === "undefined" ? {} : loadOverrides(),
  );
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(
    () => registerResumeSnapshot?.selectedBeachId ?? null,
  );
  const [soloBeachId, setSoloBeachId] = useState<string | null>(
    () => registerResumeSnapshot?.soloBeachId ?? null,
  );
  const [isLidoModalOpen, setIsLidoModalOpen] = useState(
    () => registerResumeSnapshot?.isLidoModalOpen ?? false,
  );
  const [pendingDeepLinkBeachId, setPendingDeepLinkBeachId] = useState<
    string | null
  >(null);
  const [deepLinkInfo, setDeepLinkInfo] = useState<{
    id: string | null;
    matched: boolean | null;
    params: {
      src?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
  }>({ id: null, matched: null, params: {} });
  const [deepLinkWarning, setDeepLinkWarning] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(
    () => registerResumeSnapshot?.sheetOpen ?? false,
  );
  const [reportOpen, setReportOpen] = useState(
    () => registerResumeSnapshot?.reportOpen ?? false,
  );
  const [reportError, setReportError] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [editPositions, setEditPositions] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [locationToastTone, setLocationToastTone] = useState<ToastTone>("info");
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [accountRequiredOpen, setAccountRequiredOpen] = useState(false);
  const [accountRequiredBeachName, setAccountRequiredBeachName] = useState<
    string | null
  >(null);
  const [pendingFavoriteBeachId, setPendingFavoriteBeachId] = useState<
    string | null
  >(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [reportThanksOpen, setReportThanksOpen] = useState(false);
  const [debugToast, setDebugToast] = useState<string | null>(null);
  const [debugRefreshKey, setDebugRefreshKey] = useState(0);
  const [perfSnapshot, setPerfSnapshot] = useState(() => getPerfSnapshot());
  const [splashPhase, setSplashPhase] = useState<
    "visible" | "fading" | "hidden"
  >("visible");
  const [mapReady, setMapReady] = useState(false);
  const [weatherByKey, setWeatherByKey] = useState<
    Record<string, WeatherCacheEntry>
  >({});
  const mapRef = useRef<LeafletMap | null>(null);
  const resumeMapViewRef = useRef<RegisterResumeMapView | null>(
    registerResumeSnapshot?.mapView ?? null,
  );
  const watchIdRef = useRef<number | null>(null);
  const followInitializedRef = useRef(false);
  const followModeRef = useRef(false);
  const didInitRef = useRef(false);
  const lastSelectedBeachIdRef = useRef<string | null>(null);
  const selectionSourceRef = useRef<AnalyticsSource | null>(null);
  const reportOpenRef = useRef(false);
  const deepLinkProcessedRef = useRef(false);
  const reportsUnavailableToastShownRef = useRef(false);
  const reportsFeedReadyRef = useRef(false);
  const reportsFeedGraceElapsedRef = useRef(false);

  const isDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname.startsWith("/debug") ||
      window.localStorage.getItem("br_debug_v1") === "1"
    );
  }, []);

  const useMockCrowd = useMemo(() => {
    if (typeof window === "undefined") return FEATURE_FLAGS.useMockCrowd;
    const params = new URLSearchParams(window.location.search);
    const queryOverride = readQueryBooleanFlag(
      params,
      "mockCrowd",
      "mock_crowd",
    );
    if (queryOverride !== null) return queryOverride;
    return FEATURE_FLAGS.useMockCrowd;
  }, []);

  const allowRemoteReports = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (FEATURE_FLAGS.forceRemoteReports) return true;
    if (window.sessionStorage.getItem(REMOTE_REPORT_SESSION_KEY) === "1") {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    const enabled =
      params.get("reportAnywhere") === "1" ||
      params.get("report_anywhere") === "1";
    if (enabled) {
      window.sessionStorage.setItem(REMOTE_REPORT_SESSION_KEY, "1");
    }
    return enabled;
  }, []);

  const effectiveEditMode = isDebug && editPositions;

  useRenderCounter("App", isDebug);

  useEffect(() => {
    if (!isDebug || typeof window === "undefined") return;
    const handleUpdate = () => setDebugRefreshKey((prev) => prev + 1);
    window.addEventListener(ANALYTICS_UPDATE_EVENT, handleUpdate);
    window.addEventListener(ATTRIBUTION_UPDATE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(ANALYTICS_UPDATE_EVENT, handleUpdate);
      window.removeEventListener(ATTRIBUTION_UPDATE_EVENT, handleUpdate);
    };
  }, [isDebug]);

  useEffect(() => {
    if (!isDebug) return;
    setPerfSnapshot(getPerfSnapshot());
    return subscribePerf((snapshot) => setPerfSnapshot(snapshot));
  }, [isDebug]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const fadeTimeout = window.setTimeout(() => {
      setSplashPhase("fading");
    }, 2100);
    const hideTimeout = window.setTimeout(() => {
      setSplashPhase("hidden");
    }, 2500);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, []);

  useEffect(() => {
    console.info(`Loaded spots: ${SPOTS.length}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    track("app_open");

    const searchParams = new URLSearchParams(window.location.search);
    const beachParam = searchParams.get("beach");
    const beachIdParam = searchParams.get("beachId");
    const deepLinkId =
      registerResumeSnapshot === null ? beachParam ?? beachIdParam : null;
    if (registerResumeSnapshot === null && deepLinkId) {
      setPendingDeepLinkBeachId(deepLinkId);
    }

    const attributionParams = extractAttributionParams(searchParams);
    setDeepLinkInfo({
      id: deepLinkId ?? null,
      matched: deepLinkId ? null : false,
      params: attributionParams,
    });
    setDeepLinkWarning(null);
    upsertAttribution(attributionParams);

    const srcParam = attributionParams.src;
    const utmSource = attributionParams.utm_source?.toLowerCase();
    const utmMedium = attributionParams.utm_medium?.toLowerCase();
    const utmCampaign = attributionParams.utm_campaign;
    const isQrOpen =
      Boolean(srcParam) || utmSource === "qr" || utmMedium === "poster";

    if (isQrOpen) {
      track("qr_open", { src: srcParam, utm_campaign: utmCampaign });
    }
  }, [registerResumeSnapshot]);

  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);

  useEffect(() => {
    if (!locationToast) return;
    const timeout = window.setTimeout(() => {
      setLocationToast(null);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [locationToast]);

  const showLocationToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      setLocationToastTone(tone);
      setLocationToast(message);
    },
    [],
  );

  useEffect(() => {
    if (!debugToast) return;
    const timeout = window.setTimeout(() => {
      setDebugToast(null);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [debugToast]);

  useEffect(() => {
    let active = true;
    void getCurrentAccount().then((nextAccount) => {
      if (!active) return;
      setAccount(nextAccount);
    });

    const unsubscribe = subscribeAccountChanges((nextAccount) => {
      if (!active) return;
      setAccount(nextAccount);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const graceTimeoutId = window.setTimeout(() => {
      reportsFeedGraceElapsedRef.current = true;
    }, REPORTS_FEED_ERROR_TOAST_GRACE_MS);

    const syncReports = async () => {
      const result = await fetchSharedReports();
      if (!active) return;

      if (result.ok) {
        setReports(result.reports);
        reportsFeedReadyRef.current = true;
        reportsUnavailableToastShownRef.current = false;
        return;
      }

      const canShowUnavailableToast =
        reportsFeedReadyRef.current || reportsFeedGraceElapsedRef.current;
      if (!canShowUnavailableToast) return;

      if (!reportsUnavailableToastShownRef.current) {
        reportsUnavailableToastShownRef.current = true;
        showLocationToast(STRINGS.report.feedUnavailable, "error");
      }
    };

    void syncReports();
    const intervalId = window.setInterval(() => {
      void syncReports();
    }, FEATURE_FLAGS.reportsPollMs);

    return () => {
      active = false;
      window.clearTimeout(graceTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [showLocationToast]);

  useEffect(() => {
    let active = true;
    if (!account) {
      setFavoriteBeachIds(new Set());
      return () => {
        active = false;
      };
    }
    void loadFavoriteBeachIds(account.id).then((favoriteIds) => {
      if (!active) return;
      setFavoriteBeachIds(new Set(favoriteIds));
    });
    return () => {
      active = false;
    };
  }, [account]);

  useEffect(() => {
    if (account) return;
    setProfileOpen(false);
    setDeletingAccount(false);
  }, [account]);

  const handleGeoError = useCallback((error: GeolocationPositionError | null) => {
    if (error && error.code === error.PERMISSION_DENIED) {
      setGeoStatus("denied");
      setGeoError(STRINGS.location.permissionDenied);
      return;
    }
    setGeoStatus("error");
    setGeoError(STRINGS.location.fetchError);
  }, []);

  const updateLocation = useCallback((position: GeolocationPosition) => {
    const nextLocation: UserLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      ts: position.timestamp,
    };
    setUserLocation(nextLocation);
    setGeoStatus("ready");
    setGeoError(null);
    return nextLocation;
  }, []);

  const focusMapOnLocation = useCallback(
    (location: UserLocation, preferredZoom = LOCATION_FOCUS_ZOOM) => {
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom();
      const nextZoom = Number.isFinite(currentZoom)
        ? Math.max(currentZoom, preferredZoom)
        : preferredZoom;
      map.flyTo([location.lat, location.lng], nextZoom, {
        animate: true,
        duration: 0.9,
        easeLinearity: 0.25,
      });
    },
    [],
  );

  const requestLocation = useCallback(
    (options?: {
      flyTo?: boolean;
      showToast?: boolean;
      forceFresh?: boolean;
      silent?: boolean;
    }) => {
      if (!navigator.geolocation) {
        setGeoStatus("error");
        setGeoError(STRINGS.location.notSupported);
        if (options?.showToast) {
          showLocationToast(STRINGS.location.toastUnavailable, "info");
        }
        return;
      }
      if (!options?.silent) {
        setGeoStatus("loading");
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = updateLocation(position);
          if (options?.flyTo) {
            focusMapOnLocation(nextLocation);
          }
          if (options?.showToast) {
            showLocationToast(STRINGS.location.centered, "success");
          }
        },
        (error) => {
          handleGeoError(error);
          if (options?.showToast) {
            showLocationToast(STRINGS.location.toastUnavailable, "info");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: options?.forceFresh ? 0 : 15000,
          timeout: 8000,
        },
      );
    },
    [focusMapOnLocation, handleGeoError, showLocationToast, updateLocation],
  );

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      requestLocation({ silent: true, forceFresh: true });
    }, LOCATION_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [requestLocation]);

  useEffect(() => {
    if (!followMode) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      followInitializedRef.current = false;
      return;
    }

    if (!navigator.geolocation) {
      handleGeoError(null);
      showLocationToast(STRINGS.location.toastUnavailable, "info");
      setFollowMode(false);
      return;
    }

    setGeoStatus("loading");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = updateLocation(position);
        const map = mapRef.current;
        if (!map || !followModeRef.current) return;
        if (!followInitializedRef.current) {
          map.flyTo([nextLocation.lat, nextLocation.lng], 16, { animate: true });
          followInitializedRef.current = true;
        } else {
          map.setView([nextLocation.lat, nextLocation.lng], map.getZoom(), {
            animate: true,
          });
        }
      },
      (error) => {
        handleGeoError(error);
        showLocationToast(STRINGS.location.toastUnavailable, "info");
        setFollowMode(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [followMode, handleGeoError, showLocationToast, updateLocation]);

  const handleOverride = useCallback(
    (beachId: string, lat: number, lng: number) => {
      const nextOverrides = setOverride(beachId, lat, lng);
      setOverrides(nextOverrides);
      if (isDebug) setDebugToast(STRINGS.debug.positionSaved);
    },
    [isDebug],
  );

  const handleResetOverride = useCallback((beachId: string) => {
    const nextOverrides = clearOverride(beachId);
    setOverrides(nextOverrides);
  }, []);

  const handleResetAllOverrides = useCallback(() => {
    const nextOverrides = clearOverrides();
    setOverrides(nextOverrides);
  }, []);

  const handleLocateClick = useCallback(() => {
    if (followModeRef.current) {
      setFollowMode(false);
    }
    if (userLocation) {
      focusMapOnLocation(userLocation);
      requestLocation({
        flyTo: true,
        forceFresh: true,
        silent: true,
        showToast: true,
      });
      return;
    }

    requestLocation({ flyTo: true, showToast: true, forceFresh: true });
  }, [focusMapOnLocation, requestLocation, userLocation]);

  const handleUserLocationPinTap = useCallback(() => {
    handleLocateClick();
  }, [handleLocateClick]);

  const handleUserInteract = useCallback(() => {
    if (followModeRef.current) {
      setFollowMode(false);
    }
  }, []);

  const handleShowAllPins = useCallback(() => {
    setSoloBeachId(null);
    const map = mapRef.current;
    if (!map) return;
    const currentZoom = map.getZoom();
    if (!Number.isFinite(currentZoom) || currentZoom < SHOW_ALL_PINS_ZOOM_TRIGGER) {
      return;
    }
    const minZoom = map.getMinZoom?.() ?? 0;
    const targetZoom = Math.max(
      minZoom,
      currentZoom - SHOW_ALL_PINS_ZOOM_OUT_DELTA,
    );
    if (targetZoom >= currentZoom) return;
    map.flyTo(map.getCenter(), targetZoom, {
      animate: true,
      duration: SHOW_ALL_PINS_FLY_DURATION_S,
      easeLinearity: 0.25,
    });
  }, []);

  const visibleSpots = useMemo(
    () =>
      isDebug
        ? SPOTS
        : SPOTS.filter((spot) => spot.status !== "draft"),
    [isDebug],
  );

  const reportsIndex = useMemo(() => buildReportsIndex(reports), [reports]);

  const coordStats = useMemo(() => {
    const total = visibleSpots.length;
    let valid = 0;
    visibleSpots.forEach((beach) => {
      const override = overrides[beach.id];
      const lat = override?.lat ?? beach.lat;
      const lng = override?.lng ?? beach.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) valid += 1;
    });
    return { total, valid, missing: total - valid };
  }, [visibleSpots, overrides]);

  const overrideCount = useMemo(() => Object.keys(overrides).length, [overrides]);

  useEffect(() => {
    if (!isDebug) return;
    console.info(
      `Debug coords: total=${coordStats.total} valid=${coordStats.valid} missing=${coordStats.missing}`,
    );
  }, [coordStats.missing, coordStats.total, coordStats.valid, isDebug]);

  const beachViewsBase = useMemo<BeachWithStats[]>(() => {
    return visibleSpots
      .map((beach, index) => {
        const override = overrides[beach.id];
        const lat = override?.lat ?? beach.lat;
        const lng = override?.lng ?? beach.lng;
        const stats = aggregateBeachStatsFromIndex(beach, reportsIndex, now);
        const mockLevel =
          MOCK_CROWD_LEVELS[index % MOCK_CROWD_LEVELS.length] ??
          (1 as CrowdLevel);
        const isPred = stats.state === "PRED";
        const effectiveStats = useMockCrowd
          ? {
              ...stats,
              crowdLevel: mockLevel,
              state: isPred ? "LIVE" : stats.state,
              updatedAt: isPred ? now : stats.updatedAt,
              reportsCount: isPred ? Math.max(1, stats.reportsCount) : stats.reportsCount,
              confidence: isPred ? Math.max(0.7, stats.confidence) : stats.confidence,
            }
          : stats;
        return { ...beach, lat, lng, ...effectiveStats, distanceM: null };
      })
      .filter((beach) => hasFiniteCoords(beach));
  }, [visibleSpots, overrides, reportsIndex, now, useMockCrowd]);

  const beachViews = useMemo<BeachWithStats[]>(() => {
    if (!userLocation) return beachViewsBase;
    return beachViewsBase.map((beach) => ({
      ...beach,
      distanceM: distanceInMeters(userLocation, { lat: beach.lat, lng: beach.lng }),
    }));
  }, [beachViewsBase, userLocation]);

  const normalizedSearch = search.trim().toLowerCase();

  const searchBeaches = useMemo(
    () => visibleSpots.map(({ id, name, region }) => ({ id, name, region })),
    [visibleSpots],
  );

  const matchedBeachIds = useMemo(() => {
    if (!normalizedSearch) return null;
    const nextMatches = new Set<string>();
    for (const beach of beachViewsBase) {
      if (
        beach.name.toLowerCase().includes(normalizedSearch) ||
        beach.region.toLowerCase().includes(normalizedSearch)
      ) {
        nextMatches.add(beach.id);
      }
    }
    return nextMatches;
  }, [beachViewsBase, normalizedSearch]);

  const filteredBeachesBase = useMemo(() => {
    if (!matchedBeachIds) return beachViewsBase;
    return beachViewsBase.filter((beach) => matchedBeachIds.has(beach.id));
  }, [beachViewsBase, matchedBeachIds]);

  const filteredBeaches = useMemo(() => {
    if (!matchedBeachIds) return beachViews;
    return beachViews.filter((beach) => matchedBeachIds.has(beach.id));
  }, [beachViews, matchedBeachIds]);
  const mapBeaches = useMemo(() => {
    if (!soloBeachId) return filteredBeachesBase;
    const focused = beachViewsBase.find((beach) => beach.id === soloBeachId);
    return focused ? [focused] : filteredBeachesBase;
  }, [beachViewsBase, filteredBeachesBase, soloBeachId]);

  const liveDataNotice = useMemo(() => {
    const total = beachViewsBase.length;
    if (total === 0) return null;
    let predCount = 0;
    beachViewsBase.forEach((beach) => {
      if (beach.state === "PRED") predCount += 1;
    });
    return predCount / total >= 0.85 ? STRINGS.banners.limitedData : null;
  }, [beachViewsBase]);

  const nearbyBeaches = useMemo(() => {
    if (!userLocation) return [];
    return filteredBeaches.filter(
      (beach) =>
        typeof beach.distanceM === "number" && beach.distanceM <= NEARBY_RADIUS_M,
    );
  }, [filteredBeaches, userLocation]);

  const sortedBeaches = useMemo(() => {
    return [...nearbyBeaches].sort((a, b) => {
      if (a.distanceM !== null && b.distanceM !== null) {
        return a.distanceM - b.distanceM;
      }
      if (a.distanceM !== null) return -1;
      if (b.distanceM !== null) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [nearbyBeaches]);
  const favoriteBeachesForSheet = useMemo(() => {
    const byId = new Map(beachViews.map((beach) => [beach.id, beach] as const));
    return Array.from(favoriteBeachIds)
      .map((id) => byId.get(id))
      .filter((beach): beach is BeachWithStats => Boolean(beach))
      .sort((a, b) => {
        if (a.distanceM !== null && b.distanceM !== null) {
          return a.distanceM - b.distanceM;
        }
        if (a.distanceM !== null) return -1;
        if (b.distanceM !== null) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [beachViews, favoriteBeachIds]);
  const profileFavoriteBeaches = useMemo(() => {
    const byId = new Map(beachViewsBase.map((beach) => [beach.id, beach] as const));
    return Array.from(favoriteBeachIds)
      .map((id) => byId.get(id))
      .filter((beach): beach is BeachWithStats => Boolean(beach))
      .map((beach) => ({
        id: beach.id,
        name: beach.name,
        region: beach.region,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [beachViewsBase, favoriteBeachIds]);

  const selectedBeach = beachViewsBase.find(
    (beach) => beach.id === selectedBeachId,
  );
  const selectedBeachIsFavorite =
    !!selectedBeachId && favoriteBeachIds.has(selectedBeachId);
  const selectedBeachLat = selectedBeach?.lat ?? null;
  const selectedBeachLng = selectedBeach?.lng ?? null;
  const reportDistanceM =
    selectedBeach &&
    userLocation &&
    Number.isFinite(selectedBeach.lat) &&
    Number.isFinite(selectedBeach.lng)
      ? distanceInMeters(userLocation, {
          lat: selectedBeach.lat,
          lng: selectedBeach.lng,
        })
      : null;
  const selectedOverride = selectedBeachId ? overrides[selectedBeachId] : null;
  const selectedWeatherKey =
    selectedBeachLat !== null &&
    selectedBeachLng !== null &&
    Number.isFinite(selectedBeachLat) &&
    Number.isFinite(selectedBeachLng)
      ? weatherCacheKey(selectedBeachLat, selectedBeachLng)
      : null;
  const selectedWeatherEntry = selectedWeatherKey
    ? weatherByKey[selectedWeatherKey]
    : undefined;
  const selectedWeather = selectedWeatherEntry?.data ?? null;
  const selectedWeatherLoading =
    selectedWeatherEntry?.status === "loading" &&
    selectedWeatherEntry.data === null;
  const selectedWeatherUnavailable =
    selectedWeatherEntry?.status === "error" &&
    selectedWeatherEntry.data === null;
  const beachIdSet = useMemo(
    () => new Set(beachViewsBase.map((beach) => beach.id)),
    [beachViewsBase],
  );
  const debugAttribution = useMemo(
    () => {
      void debugRefreshKey;
      return isDebug ? loadAttribution() : null;
    },
    [debugRefreshKey, isDebug],
  );
  const debugEvents = useMemo(
    () => {
      void debugRefreshKey;
      return isDebug ? loadEvents() : [];
    },
    [debugRefreshKey, isDebug],
  );

  useEffect(() => {
    if (!selectedWeatherKey) return;
    if (
      selectedBeachLat === null ||
      selectedBeachLng === null ||
      !Number.isFinite(selectedBeachLat) ||
      !Number.isFinite(selectedBeachLng)
    ) {
      return;
    }

    const nowTs = Date.now();
    if (selectedWeatherEntry?.status === "loading") return;
    if (
      selectedWeatherEntry?.status === "ready" &&
      selectedWeatherEntry.expiresAt > nowTs
    ) {
      return;
    }

    const controller = new AbortController();
    setWeatherByKey((prev) => {
      const current = prev[selectedWeatherKey];
      return {
        ...prev,
        [selectedWeatherKey]: {
          status: "loading",
          data: current?.data ?? null,
          expiresAt: current?.expiresAt ?? 0,
        },
      };
    });

    void fetchBeachWeather(selectedBeachLat, selectedBeachLng, controller.signal)
      .then((snapshot) => {
        setWeatherByKey((prev) => ({
          ...prev,
          [selectedWeatherKey]: {
            status: "ready",
            data: snapshot,
            expiresAt: snapshot.expiresAt,
          },
        }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setWeatherByKey((prev) => {
          const current = prev[selectedWeatherKey];
          return {
            ...prev,
            [selectedWeatherKey]: {
              status: "error",
              data: current?.data ?? null,
              expiresAt: current?.expiresAt ?? 0,
            },
          };
        });
      });

    return () => controller.abort();
  // Intentionally exclude selectedWeatherEntry to avoid aborting in-flight
  // requests when we flip cache status to "loading".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedBeachLat,
    selectedBeachLng,
    selectedWeatherKey,
  ]);

  useEffect(() => {
    if (selectedBeachId && !selectedBeach) {
      setSelectedBeachId(null);
      setSoloBeachId(null);
      setIsLidoModalOpen(false);
    }
  }, [selectedBeach, selectedBeachId]);

  useEffect(() => {
    if (!soloBeachId) return;
    if (!selectedBeachId || selectedBeachId !== soloBeachId) {
      setSoloBeachId(null);
    }
  }, [selectedBeachId, soloBeachId]);

  const focusBeach = useCallback(
    (
      beachId: string,
      options?: { updateSearch?: boolean; moveMap?: boolean; solo?: boolean },
    ) => {
      const beach = beachViewsBase.find((item) => item.id === beachId);
      if (!beach) return;
      if (options?.updateSearch) {
        setSearch(beach.name);
      }
      setSelectedBeachId(beach.id);
      setSoloBeachId(options?.solo ? beach.id : null);
      setIsLidoModalOpen(true);
      setSheetOpen(false);
      const shouldMoveMap = options?.moveMap ?? true;
      const map = mapRef.current;
      if (
        shouldMoveMap &&
        map &&
        Number.isFinite(beach.lat) &&
        Number.isFinite(beach.lng)
      ) {
        const offsetY = Math.round(map.getSize().y * 0.25);
        const currentZoom = map.getZoom();
        const zoomDelta = Number.isFinite(currentZoom)
          ? Math.max(0, BEACH_FOCUS_ZOOM - currentZoom)
          : 0;
        const flyDuration = Math.min(3.2, Math.max(1.4, 0.8 + zoomDelta * 0.15));
        map.once("moveend", () => {
          if (offsetY) {
            map.panBy([0, -offsetY], { animate: true });
          }
        });
        map.flyTo([beach.lat, beach.lng], BEACH_FOCUS_ZOOM, {
          animate: true,
          duration: flyDuration,
          easeLinearity: 0.25,
        });
      }
    },
    [beachViewsBase],
  );

  useEffect(() => {
    if (!pendingDeepLinkBeachId) return;
    if (deepLinkProcessedRef.current) return;
    if (beachViewsBase.length === 0) return;
    const beachExists = beachIdSet.has(pendingDeepLinkBeachId);
    setDeepLinkInfo((prev) => ({
      ...prev,
      matched: beachExists,
    }));
    if (!beachExists) {
      setPendingDeepLinkBeachId(null);
      deepLinkProcessedRef.current = true;
      const warning = `Deep link beach id not found in SPOTS: ${pendingDeepLinkBeachId}`;
      setDeepLinkWarning(warning);
      const sampleIds = beachViewsBase.slice(0, 5).map((beach) => beach.id);
      console.warn(warning, "Sample ids:", sampleIds);
      return;
    }

    selectionSourceRef.current = "deeplink";
    setSelectedBeachId(pendingDeepLinkBeachId);
    setSoloBeachId(pendingDeepLinkBeachId);
    setIsLidoModalOpen(true);
    setSheetOpen(false);
    deepLinkProcessedRef.current = true;
  }, [beachIdSet, beachViewsBase, pendingDeepLinkBeachId]);

  useEffect(() => {
    if (!pendingDeepLinkBeachId) return;
    if (!mapReady || !mapRef.current) return;
    if (deepLinkInfo.matched === false) return;
    selectionSourceRef.current = "deeplink";
    focusBeach(pendingDeepLinkBeachId, { updateSearch: false, solo: true });
    setPendingDeepLinkBeachId(null);
  }, [deepLinkInfo.matched, focusBeach, mapReady, pendingDeepLinkBeachId]);

  const handleSelectBeach = useCallback(
    (beachId: string) => {
      focusBeach(beachId, { solo: true });
    },
    [focusBeach],
  );

  const handleSelectBeachFromMarker = useCallback(
    (beachId: string) => {
      selectionSourceRef.current = "marker";
      focusBeach(beachId, { solo: true });
    },
    [focusBeach],
  );

  const handleSelectSuggestion = useCallback(
    (beachId: string) => {
      selectionSourceRef.current = "search";
      focusBeach(beachId, { updateSearch: true, solo: true });
    },
    [focusBeach],
  );

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    const resumeView = resumeMapViewRef.current;
    if (resumeView) {
      map.setView([resumeView.lat, resumeView.lng], resumeView.zoom, {
        animate: false,
      });
      resumeMapViewRef.current = null;
    } else {
      map.fitBounds(ITALY_BOUNDS, {
        animate: false,
        maxZoom: INITIAL_MAP_ZOOM,
        paddingTopLeft: [16, 96],
        paddingBottomRight: [16, 140],
      });
    }
    setMapReady(true);
  }, []);

  const handleToggleSheet = useCallback(() => {
    setSheetOpen((prev) => !prev);
  }, []);

  const handleOpenReport = useCallback(() => {
    setReportOpen(true);
    setReportError(null);
  }, []);

  const handleCloseReport = useCallback(() => {
    setReportOpen(false);
    setReportError(null);
  }, []);

  useEffect(() => {
    if (!selectedBeachId) {
      lastSelectedBeachIdRef.current = null;
      return;
    }
    if (selectedBeachId === lastSelectedBeachIdRef.current) return;
    lastSelectedBeachIdRef.current = selectedBeachId;
    const source = selectionSourceRef.current ?? undefined;
    track("beach_view", { beachId: selectedBeachId, source });
    selectionSourceRef.current = null;
  }, [selectedBeachId]);

  useEffect(() => {
    if (!reportOpen) {
      reportOpenRef.current = false;
      return;
    }
    if (reportOpenRef.current) return;
    reportOpenRef.current = true;
    track("report_open", { beachId: selectedBeachId ?? undefined });
  }, [reportOpen, selectedBeachId]);

  const handleCloseDrawer = useCallback(() => {
    if (reportOpen) return;
    setIsLidoModalOpen(false);
  }, [reportOpen]);

  const handleOpenWeatherDetails = useCallback(() => {
    if (reportOpen || !selectedBeach) return;
    setSheetOpen(false);
    setIsLidoModalOpen(true);
  }, [reportOpen, selectedBeach]);

  const handleToggleFavorite = useCallback((beachId: string) => {
    if (!account) {
      const beach = beachViewsBase.find((item) => item.id === beachId);
      setAccountRequiredBeachName(beach?.name ?? null);
      setPendingFavoriteBeachId(beachId);
      setAccountRequiredOpen(true);
      return;
    }
    const shouldFavorite = !favoriteBeachIds.has(beachId);
    track(shouldFavorite ? "favorite_add" : "favorite_remove", { beachId });

    setFavoriteBeachIds((prev) => {
      const next = new Set(prev);
      if (shouldFavorite) {
        next.add(beachId);
      } else {
        next.delete(beachId);
      }
      return next;
    });

    void setFavoriteBeach(account.id, beachId, shouldFavorite).then((result) => {
      if (result.ok) return;

      setFavoriteBeachIds((prev) => {
        const reverted = new Set(prev);
        if (shouldFavorite) {
          reverted.delete(beachId);
        } else {
          reverted.add(beachId);
        }
        return reverted;
      });

      if (result.code === "unauthorized") {
        setAccount(null);
        const beach = beachViewsBase.find((item) => item.id === beachId);
        setAccountRequiredBeachName(beach?.name ?? null);
        setPendingFavoriteBeachId(beachId);
        setAccountRequiredOpen(true);
        return;
      }

      showLocationToast(STRINGS.account.favoriteSyncFailed, "error");
    });
  }, [account, beachViewsBase, favoriteBeachIds, showLocationToast]);

  const handleToggleSelectedFavorite = useCallback(() => {
    if (!selectedBeachId) return;
    handleToggleFavorite(selectedBeachId);
  }, [handleToggleFavorite, selectedBeachId]);

  const handleCloseAccountRequired = useCallback(() => {
    setAccountRequiredOpen(false);
    setAccountRequiredBeachName(null);
    setPendingFavoriteBeachId(null);
  }, []);

  const handleSignOut = useCallback(() => {
    void signOutAccount().then((result) => {
      if (!result.ok) {
        showLocationToast(STRINGS.account.signOutFailed, "error");
        return;
      }
      setAccount(null);
      setFavoriteBeachIds(new Set());
      setProfileOpen(false);
      setAccountRequiredOpen(false);
      setAccountRequiredBeachName(null);
      setPendingFavoriteBeachId(null);
    });
  }, [showLocationToast]);

  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    if (!window.confirm(STRINGS.account.deleteAccountConfirm)) return;
    setDeletingAccount(true);
    void deleteCurrentAccount()
      .then(async (result) => {
        if (!result.ok) {
          showLocationToast(STRINGS.account.deleteAccountFailed, "error");
          return;
        }
        await signOutAccount();
        setAccount(null);
        setFavoriteBeachIds(new Set());
        setProfileOpen(false);
        showLocationToast(STRINGS.account.deleteAccountSuccess, "success");
      })
      .finally(() => setDeletingAccount(false));
  }, [deletingAccount, showLocationToast]);

  const accountDisplayName = useMemo(() => {
    if (!account) return null;
    const fullName = `${account.firstName} ${account.lastName}`.trim();
    return fullName.length > 0 ? fullName : null;
  }, [account]);

  const navigateToRegister = useCallback((options?: {
    favoriteBeachId?: string | null;
    beachName?: string | null;
    authMode?: "login" | "register";
  }) => {
    const map = mapRef.current;
    const center = map?.getCenter();
    const zoom = map?.getZoom();
    const mapView =
      center && typeof zoom === "number" && Number.isFinite(zoom)
        ? { lat: center.lat, lng: center.lng, zoom }
        : null;

    const resumeSnapshot: RegisterResumeSnapshot = {
      search,
      selectedBeachId,
      soloBeachId,
      isLidoModalOpen,
      sheetOpen,
      reportOpen,
      mapView,
    };

    window.sessionStorage.setItem(
      REGISTER_RESUME_KEY,
      JSON.stringify(resumeSnapshot),
    );

    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const params = new URLSearchParams({ returnTo });
    if (options?.favoriteBeachId) params.set("fav", options.favoriteBeachId);
    if (options?.beachName) params.set("beachName", options.beachName);
    if (options?.authMode === "login") params.set("mode", "login");
    const registerPath = window.location.pathname.startsWith("/app")
      ? "/app/register"
      : "/register";

    track("auth_gate_redirect", {
      beachId: options?.favoriteBeachId ?? selectedBeachId ?? undefined,
    });
    window.location.assign(`${registerPath}?${params.toString()}`);
  }, [
    isLidoModalOpen,
    reportOpen,
    search,
    selectedBeachId,
    sheetOpen,
    soloBeachId,
  ]);

  const handleContinueToRegister = useCallback(() => {
    navigateToRegister({
      favoriteBeachId: pendingFavoriteBeachId,
      beachName: accountRequiredBeachName,
    });
  }, [accountRequiredBeachName, navigateToRegister, pendingFavoriteBeachId]);

  const handleOpenSignIn = useCallback(() => {
    navigateToRegister({ authMode: "login" });
  }, [navigateToRegister]);

  const handleOpenProfile = useCallback(() => {
    if (!account) return;
    setProfileOpen(true);
  }, [account]);

  const handleSelectProfileFavorite = useCallback(
    (beachId: string) => {
      setProfileOpen(false);
      focusBeach(beachId, { solo: true });
    },
    [focusBeach],
  );

  const handleSubmitReport = useCallback((level: CrowdLevel) => {
    if (!selectedBeach || submittingReport) return;
    if (
      !allowRemoteReports &&
      reportDistanceM !== null &&
      reportDistanceM > REPORT_RADIUS_M
    ) {
      track("report_submit_blocked_geofence", { beachId: selectedBeach.id });
      return;
    }

    const reporterHash = getReporterHash();
    const attribution = loadAttribution() ?? undefined;
    setSubmittingReport(true);

    void submitSharedReport({
      beachId: selectedBeach.id,
      crowdLevel: level,
      reporterHash,
      attribution,
    })
      .then((result) => {
        if (result.ok) {
          setReports((prev) => {
            const deduped = prev.filter((report) => report.id !== result.report.id);
            return [result.report, ...deduped];
          });
          setNow(Date.now);
          setReportError(null);
          setReportOpen(false);
          setReportThanksOpen(true);
          track("report_submit_success", {
            beachId: selectedBeach.id,
            level,
          });
          return;
        }

        if (result.code === "too_soon") {
          setReportError(STRINGS.report.tooSoon);
          track("report_submit_blocked_rate_limit", {
            beachId: selectedBeach.id,
          });
          return;
        }

        setReportError(STRINGS.report.submitFailed);
      })
      .finally(() => {
        setSubmittingReport(false);
      });
  }, [allowRemoteReports, reportDistanceM, selectedBeach, submittingReport]);

  const handleShare = useCallback(async () => {
    if (!selectedBeach) return;
    setShareToast(STRINGS.share.preparing);
    try {
      const { shareBeachCard } = await import("../components/ShareCard");
      await shareBeachCard({
        name: selectedBeach.name,
        region: selectedBeach.region,
        crowdLevel: selectedBeach.crowdLevel,
        state: selectedBeach.state,
        confidence: formatConfidence(selectedBeach.confidence),
        updatedLabel: formatMinutesAgo(selectedBeach.updatedAt, now),
        reportsCount: selectedBeach.reportsCount,
      });
    } catch {
      // Share failures should be silent for MVP.
    } finally {
      setShareToast(null);
    }
  }, [now, selectedBeach]);

  const handleShareFromThanks = useCallback(() => {
    setReportThanksOpen(false);
    void handleShare();
  }, [handleShare]);

  const handleCopyDebugExport = async () => {
    const payload = {
      attribution: debugAttribution ?? undefined,
      events: debugEvents,
    };
    if (!navigator.clipboard?.writeText) {
      setDebugToast(STRINGS.debug.exportFailed);
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setDebugToast(STRINGS.debug.exportCopied);
    } catch {
      setDebugToast(STRINGS.debug.exportFailed);
    }
  };

  const handleClearEvents = () => {
    clearEvents();
    setDebugToast(STRINGS.debug.eventsCleared);
  };

  const handleClearAttribution = () => {
    clearAttribution();
    setDebugToast(STRINGS.debug.attributionCleared);
  };

  const mapCenter = DEFAULT_CENTER;

  if (splashPhase !== "hidden") {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-cover bg-center transition-opacity duration-400 ${
          splashPhase === "fading" ? "opacity-0" : "opacity-100"
        }`}
        style={{ backgroundImage: `url(${splashBg})` }}
      >
        <div className="flex flex-col items-center gap-0">
          <img src={logo} alt="Beach Radar" className="h-64 w-auto" />
          <img src={logoText} alt="Beach Radar" className="-mt-32 h-64 w-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" data-testid="app-root">
      <MapView
        beaches={mapBeaches}
        favoriteBeachIds={favoriteBeachIds}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeachFromMarker}
        center={mapCenter}
        initialZoom={INITIAL_MAP_ZOOM}
        editMode={effectiveEditMode}
        onOverride={handleOverride}
        onMapReady={handleMapReady}
        userLocation={userLocation ?? undefined}
        nowTs={now}
        onUserLocationTap={handleUserLocationPinTap}
        onUserInteract={handleUserInteract}
      />
      {isDebug ? (
        <Suspense fallback={null}>
          <PerformanceOverlay />
        </Suspense>
      ) : null}
      <TopSearch
        value={search}
        onChange={setSearch}
        resultCount={filteredBeaches.length}
        notice={liveDataNotice}
        beaches={searchBeaches}
        onSelectSuggestion={handleSelectSuggestion}
        accountEmail={account?.email ?? null}
        accountName={accountDisplayName}
        onSignIn={handleOpenSignIn}
        onOpenProfile={handleOpenProfile}
        onSignOut={handleSignOut}
      />
      {soloBeachId ? (
        <button
          type="button"
          onClick={handleShowAllPins}
          className="br-press fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-60 rounded-full border border-white/18 bg-black/35 px-4 py-2 text-[12px] font-semibold text-slate-100 backdrop-blur transition hover:border-white/28 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 sm:bottom-[calc(env(safe-area-inset-bottom)+120px)]"
        >
          {STRINGS.actions.showAllPins}
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleLocateClick}
        aria-label={STRINGS.aria.myLocation}
        className={`br-press fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-60 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 sm:bottom-[calc(env(safe-area-inset-bottom)+120px)] ${
          geoStatus === "loading"
            ? "border-sky-200/70 bg-sky-900/45 text-sky-50 shadow-[0_0_0_1px_rgba(186,230,253,0.24),0_14px_30px_rgba(2,132,199,0.35)]"
            : geoStatus === "denied" || geoStatus === "error"
              ? "border-rose-300/65 bg-rose-900/40 text-rose-50"
              : followMode
                ? "border-white/30 bg-black/50 text-slate-50 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_14px_30px_rgba(0,0,0,0.45)]"
                : "border-white/18 bg-black/30 text-slate-100"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      {locationToast ? (
        <div
          className={`fixed left-1/2 top-[calc(env(safe-area-inset-top)+130px)] z-40 -translate-x-1/2 rounded-xl border px-4 py-2 text-[12px] font-medium shadow-[0_14px_30px_rgba(0,0,0,0.45)] backdrop-blur-md ${
            locationToastTone === "error"
              ? "border-rose-300/70 bg-rose-700/45 text-rose-50"
              : locationToastTone === "success"
                ? "border-emerald-300/70 bg-emerald-700/40 text-emerald-50"
                : "border-sky-300/65 bg-sky-800/45 text-sky-50"
          }`}
        >
          {locationToast}
        </div>
      ) : null}
      {shareToast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+168px)] z-40 -translate-x-1/2 rounded-xl border border-sky-300/65 bg-sky-800/45 px-4 py-2 text-[12px] font-medium text-sky-50 shadow-[0_14px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {shareToast}
        </div>
      ) : null}
      {selectedBeach && soloBeachId && !isLidoModalOpen && !reportOpen ? (
        <WeatherWidget
          beachName={selectedBeach.name}
          weather={selectedWeather}
          weatherLoading={selectedWeatherLoading}
          weatherUnavailable={selectedWeatherUnavailable}
          onOpenDetails={handleOpenWeatherDetails}
        />
      ) : null}
      {accountRequiredOpen ? (
        <Suspense fallback={null}>
          <AccountRequiredModal
            isOpen={accountRequiredOpen}
            beachName={accountRequiredBeachName}
            onClose={handleCloseAccountRequired}
            onContinue={handleContinueToRegister}
          />
        </Suspense>
      ) : null}
      {account?.email ? (
        <Suspense fallback={null}>
          <ProfileModal
            isOpen={profileOpen}
            name={accountDisplayName}
            email={account.email}
            favoriteBeaches={profileFavoriteBeaches}
            deleting={deletingAccount}
            onClose={() => setProfileOpen(false)}
            onSelectFavorite={handleSelectProfileFavorite}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        </Suspense>
      ) : null}
      {reportThanksOpen ? (
        <Suspense fallback={null}>
          <ReportThanksModal
            isOpen={reportThanksOpen}
            onClose={() => setReportThanksOpen(false)}
            onShare={handleShareFromThanks}
          />
        </Suspense>
      ) : null}
      {isDebug && overrideCount > 0 ? (
        <div className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100 shadow-lg backdrop-blur">
          <div className="text-amber-100">
            {STRINGS.debug.overrideWarning(overrideCount)}
          </div>
        </div>
      ) : null}
      {isDebug && debugToast ? (
        <div className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-40 -translate-x-1/2 rounded-xl border border-emerald-300/70 bg-emerald-800/40 px-4 py-2 text-[12px] font-medium text-emerald-50 shadow-[0_14px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {debugToast}
        </div>
      ) : null}
      {isDebug ? (
        <div className="fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-40 w-[min(92vw,320px)] rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>{STRINGS.debug.title}</span>
            <span className="text-[10px] text-slate-500">
              {STRINGS.debug.version}
            </span>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100">
            <span>{STRINGS.debug.editPositions}</span>
            <input
              type="checkbox"
              checked={editPositions}
              onChange={(event) => setEditPositions(event.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
          </label>
          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/25 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.selectedBeach}</div>
            <div className="mt-1 text-slate-100">
              {selectedBeach ? selectedBeach.id : STRINGS.debug.none}
            </div>
            {selectedBeach ? (
              <div className="mt-1 text-slate-500">
                {STRINGS.debug.lat} {selectedBeach.lat.toFixed(5)} ·{" "}
                {STRINGS.debug.lng} {selectedBeach.lng.toFixed(5)}
              </div>
            ) : null}
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/25 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.deeplink}</div>
            <div className="mt-1 text-slate-100">
              {deepLinkInfo.id ?? STRINGS.debug.none}
            </div>
            <div className="mt-1 text-slate-500">
              {STRINGS.debug.deeplinkMatched}{" "}
              <span className="text-slate-100">
                {deepLinkInfo.id
                  ? deepLinkInfo.matched === null
                    ? STRINGS.debug.pending
                    : deepLinkInfo.matched
                      ? STRINGS.debug.yes
                      : STRINGS.debug.no
                  : STRINGS.debug.none}
              </span>
            </div>
            <div className="mt-1 text-slate-500">
              {STRINGS.debug.deeplinkParams}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-100">
              {Object.keys(deepLinkInfo.params).length > 0
                ? JSON.stringify(deepLinkInfo.params)
                : STRINGS.debug.none}
            </div>
            {deepLinkWarning ? (
              <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
                {deepLinkWarning}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedBeachId) return;
              handleResetOverride(selectedBeachId);
            }}
            disabled={!selectedBeachId || !selectedOverride}
            className="mt-3 w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {STRINGS.debug.resetOverride}
          </button>
          <button
            type="button"
            onClick={handleResetAllOverrides}
            disabled={overrideCount === 0}
            className="mt-2 w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {STRINGS.debug.resetOverrides}
          </button>
          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/25 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.attribution}</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-100">
              {debugAttribution
                ? JSON.stringify(debugAttribution)
                : STRINGS.debug.none}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/25 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.eventsCount}</div>
            <div className="mt-1 text-slate-100">{debugEvents.length}</div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/25 px-3 py-2 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <div className="text-slate-500">{STRINGS.debug.perfTitle}</div>
              <button
                type="button"
                onClick={clearPerfStats}
                className="rounded-lg border border-slate-700/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 transition hover:border-slate-500/80 hover:text-slate-100"
              >
                {STRINGS.debug.perfReset}
              </button>
            </div>
            <div className="mt-1 text-slate-100">
              {STRINGS.debug.perfClusterLast(perfSnapshot.cluster.lastMs)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {STRINGS.debug.perfClusterMeta(
                perfSnapshot.cluster.lastClusterCount,
                perfSnapshot.cluster.lastSingleCount,
                perfSnapshot.cluster.lastZoom,
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {STRINGS.debug.perfIconCache(perfSnapshot.markerIconCacheSize)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <div>{STRINGS.debug.perfRender("App", perfSnapshot.renderCounts.App)}</div>
              <div>
                {STRINGS.debug.perfRender(
                  "MapView",
                  perfSnapshot.renderCounts.MapView,
                )}
              </div>
              <div>
                {STRINGS.debug.perfRender(
                  "TopSearch",
                  perfSnapshot.renderCounts.TopSearch,
                )}
              </div>
              <div>
                {STRINGS.debug.perfRender(
                  "BottomSheet",
                  perfSnapshot.renderCounts.BottomSheet,
                )}
              </div>
              <div className="col-span-2">
                {STRINGS.debug.perfRender(
                  "LidoModalCard",
                  perfSnapshot.renderCounts.LidoModalCard,
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyDebugExport}
            className="mt-3 w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.copyExport}
          </button>
          <button
            type="button"
            onClick={handleClearEvents}
            className="mt-2 w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.clearEvents}
          </button>
          <button
            type="button"
            onClick={handleClearAttribution}
            className="mt-2 w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.clearAttribution}
          </button>
        </div>
      ) : null}
      <BottomSheet
        beaches={sortedBeaches}
        favoriteBeaches={favoriteBeachesForSheet}
        favoriteBeachIds={favoriteBeachIds}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        onToggleFavorite={handleToggleFavorite}
        isOpen={sheetOpen}
        onToggle={handleToggleSheet}
        now={now}
        hasLocation={Boolean(userLocation)}
        nearbyRadiusKm={15}
      />
      {selectedBeach ? (
        <Suspense fallback={null}>
          <LidoModalCard
            beach={selectedBeach}
            isOpen={isLidoModalOpen}
            now={now}
            isFavorite={selectedBeachIsFavorite}
            weather={selectedWeather}
            weatherLoading={selectedWeatherLoading}
            weatherUnavailable={selectedWeatherUnavailable}
            onClose={handleCloseDrawer}
            onToggleFavorite={handleToggleSelectedFavorite}
            onReport={handleOpenReport}
            onShare={handleShare}
          />
        </Suspense>
      ) : null}
      {selectedBeach ? (
        <Suspense fallback={null}>
          <ReportModal
            isOpen={reportOpen}
            beachName={selectedBeach.name}
            userLocation={userLocation}
            distanceM={reportDistanceM}
            allowRemoteReports={allowRemoteReports}
            geoStatus={geoStatus}
            geoError={geoError}
            onRequestLocation={requestLocation}
            onClose={handleCloseReport}
            onSubmit={handleSubmitReport}
            submitError={reportError}
            submitting={submittingReport}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default App;
