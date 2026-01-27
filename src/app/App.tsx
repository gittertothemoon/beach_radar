import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import MapView from "../components/MapView";
import TopSearch from "../components/TopSearch";
import BottomSheet from "../components/BottomSheet";
import LidoModalCard from "../components/LidoModalCard";
import ReportModal from "../components/ReportModal";
import PerformanceOverlay from "../components/PerformanceOverlay";
import { shareBeachCard } from "../components/ShareCard";
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
  getReporterHash,
  loadReports,
  tryAddReport,
} from "../lib/storage";
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
import type { BeachWithStats, CrowdLevel, Report } from "../lib/types";
import type { LatLng, UserLocation } from "../lib/geo";
import type { BeachOverrides } from "../lib/overrides";

const DEFAULT_CENTER: LatLng = { lat: 44.0678, lng: 12.5695 };
const BEACH_FOCUS_ZOOM = 17;
const REPORT_RADIUS_M = 700;

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "error";

function App() {
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>(() =>
    typeof window === "undefined" ? [] : loadReports(),
  );
  const [now, setNow] = useState(Date.now);
  const [overrides, setOverrides] = useState<BeachOverrides>(() =>
    typeof window === "undefined" ? {} : loadOverrides(),
  );
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [editPositions, setEditPositions] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [debugToast, setDebugToast] = useState<string | null>(null);
  const [debugRefreshKey, setDebugRefreshKey] = useState(0);
  const [perfSnapshot, setPerfSnapshot] = useState(() => getPerfSnapshot());
  const [splashPhase, setSplashPhase] = useState<
    "visible" | "fading" | "hidden"
  >("visible");
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const followInitializedRef = useRef(false);
  const followModeRef = useRef(false);
  const lastLocateTapRef = useRef(0);
  const didInitRef = useRef(false);
  const lastSelectedBeachIdRef = useRef<string | null>(null);
  const selectionSourceRef = useRef<AnalyticsSource | null>(null);
  const reportOpenRef = useRef(false);
  const deepLinkProcessedRef = useRef(false);

  const isDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname.startsWith("/debug") ||
      window.localStorage.getItem("br_debug_v1") === "1"
    );
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
    // eslint-disable-next-line no-console
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
    const deepLinkId = beachParam ?? beachIdParam;
    if (deepLinkId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, []);

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

  useEffect(() => {
    if (!debugToast) return;
    const timeout = window.setTimeout(() => {
      setDebugToast(null);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [debugToast]);

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

  const requestLocation = useCallback(
    (options?: { flyTo?: boolean; showToast?: boolean }) => {
      if (!navigator.geolocation) {
        setGeoStatus("error");
        setGeoError(STRINGS.location.notSupported);
        if (options?.showToast) {
          setLocationToast(STRINGS.location.toastUnavailable);
        }
        return;
      }
      setGeoStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = updateLocation(position);
          if (options?.flyTo && mapRef.current) {
            mapRef.current.flyTo([nextLocation.lat, nextLocation.lng], 16, {
              animate: true,
            });
          }
        },
        (error) => {
          handleGeoError(error);
          if (options?.showToast) {
            setLocationToast(STRINGS.location.toastUnavailable);
          }
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 },
      );
    },
    [handleGeoError, updateLocation],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestLocation();
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleGeoError(null);
      setLocationToast(STRINGS.location.toastUnavailable);
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
        setLocationToast(STRINGS.location.toastUnavailable);
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
  }, [followMode, handleGeoError, updateLocation]);

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
    const nowTs = Date.now();
    if (nowTs - lastLocateTapRef.current < 2000) {
      setFollowMode((prev) => !prev);
      lastLocateTapRef.current = 0;
      return;
    }
    lastLocateTapRef.current = nowTs;
    requestLocation({ flyTo: true, showToast: true });
  }, [requestLocation]);

  const handleUserInteract = useCallback(() => {
    if (followModeRef.current) {
      setFollowMode(false);
    }
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
    // eslint-disable-next-line no-console
    console.info(
      `Debug coords: total=${coordStats.total} valid=${coordStats.valid} missing=${coordStats.missing}`,
    );
  }, [coordStats.missing, coordStats.total, coordStats.valid, isDebug]);

  const beachViewsBase = useMemo<BeachWithStats[]>(() => {
    return visibleSpots
      .map((beach) => {
        const override = overrides[beach.id];
        const lat = override?.lat ?? beach.lat;
        const lng = override?.lng ?? beach.lng;
        const stats = aggregateBeachStatsFromIndex(beach, reportsIndex, now);
        return { ...beach, lat, lng, ...stats, distanceM: null };
      })
      .filter((beach) => hasFiniteCoords(beach));
  }, [visibleSpots, overrides, reportsIndex, now]);

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

  const liveDataNotice = useMemo(() => {
    const total = beachViewsBase.length;
    if (total === 0) return null;
    let predCount = 0;
    beachViewsBase.forEach((beach) => {
      if (beach.state === "PRED") predCount += 1;
    });
    return predCount / total >= 0.85 ? STRINGS.banners.limitedData : null;
  }, [beachViewsBase]);

  const sortedBeaches = useMemo(() => {
    return [...filteredBeaches].sort((a, b) => {
      if (a.distanceM !== null && b.distanceM !== null) {
        return a.distanceM - b.distanceM;
      }
      if (a.distanceM !== null) return -1;
      if (b.distanceM !== null) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredBeaches]);

  const selectedBeach = beachViewsBase.find(
    (beach) => beach.id === selectedBeachId,
  );
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
  const beachIdSet = useMemo(
    () => new Set(beachViewsBase.map((beach) => beach.id)),
    [beachViewsBase],
  );
  const debugAttribution = useMemo(
    () => (isDebug ? loadAttribution() : null),
    [debugRefreshKey, isDebug],
  );
  const debugEvents = useMemo(
    () => (isDebug ? loadEvents() : []),
    [debugRefreshKey, isDebug],
  );

  useEffect(() => {
    if (selectedBeachId && !selectedBeach) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBeachId(null);
    }
  }, [selectedBeach, selectedBeachId]);

  const focusBeach = useCallback(
    (
      beachId: string,
      options?: { updateSearch?: boolean; moveMap?: boolean },
    ) => {
      const beach = beachViewsBase.find((item) => item.id === beachId);
      if (!beach) return;
      if (options?.updateSearch) {
        setSearch(beach.name);
      }
      setSelectedBeachId(beach.id);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line no-console
      console.warn(warning, "Sample ids:", sampleIds);
      return;
    }

    selectionSourceRef.current = "deeplink";
    setSelectedBeachId(pendingDeepLinkBeachId);
    setSheetOpen(false);
    deepLinkProcessedRef.current = true;
  }, [beachIdSet, beachViewsBase, pendingDeepLinkBeachId]);

  useEffect(() => {
    if (!pendingDeepLinkBeachId) return;
    if (!mapReady || !mapRef.current) return;
    if (deepLinkInfo.matched === false) return;
    selectionSourceRef.current = "deeplink";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    focusBeach(pendingDeepLinkBeachId, { updateSearch: false });
    setPendingDeepLinkBeachId(null);
  }, [deepLinkInfo.matched, focusBeach, mapReady, pendingDeepLinkBeachId]);

  const handleSelectBeach = useCallback(
    (beachId: string) => {
      focusBeach(beachId);
    },
    [focusBeach],
  );

  const handleSelectBeachFromMarker = useCallback(
    (beachId: string) => {
      selectionSourceRef.current = "marker";
      focusBeach(beachId, { moveMap: false });
    },
    [focusBeach],
  );

  const handleSelectSuggestion = useCallback(
    (beachId: string) => {
      selectionSourceRef.current = "search";
      focusBeach(beachId, { updateSearch: true });
    },
    [focusBeach],
  );

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
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
    setSelectedBeachId(null);
  }, [reportOpen]);

  const handleSubmitReport = useCallback((level: CrowdLevel) => {
    if (!selectedBeach) return;
    if (
      reportDistanceM !== null &&
      reportDistanceM > REPORT_RADIUS_M
    ) {
      track("report_submit_blocked_geofence", { beachId: selectedBeach.id });
      return;
    }
    const reporterHash = getReporterHash();
    const attribution = loadAttribution() ?? undefined;
    const result = tryAddReport({
      beachId: selectedBeach.id,
      crowdLevel: level,
      reporterHash,
      attribution,
    });
    if (result.ok) {
      setReports(result.reports);
      setNow(Date.now);
      setReportError(null);
      setReportOpen(false);
      track("report_submit_success", {
        beachId: selectedBeach.id,
        level,
      });
    } else {
      setReportError(result.reason);
      if (result.reason === STRINGS.report.tooSoon) {
        track("report_submit_blocked_rate_limit", {
          beachId: selectedBeach.id,
        });
      }
    }
  }, [reportDistanceM, selectedBeach]);

  const handleShare = useCallback(async () => {
    if (!selectedBeach) return;
    setShareToast(STRINGS.share.preparing);
    try {
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

  const mapCenter = useMemo(() => {
    const firstBeach = beachViewsBase.find(
      (beach) => Number.isFinite(beach.lat) && Number.isFinite(beach.lng),
    );
    return firstBeach
      ? { lat: firstBeach.lat, lng: firstBeach.lng }
      : DEFAULT_CENTER;
  }, [beachViewsBase]);

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
    <div className="relative h-full w-full">
      <MapView
        beaches={filteredBeachesBase}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeachFromMarker}
        center={mapCenter}
        editMode={effectiveEditMode}
        onOverride={handleOverride}
        onMapReady={handleMapReady}
        userLocation={userLocation ?? undefined}
        onUserInteract={handleUserInteract}
      />
      {isDebug ? <PerformanceOverlay /> : null}
      <TopSearch
        value={search}
        onChange={setSearch}
        resultCount={filteredBeaches.length}
        notice={liveDataNotice}
        beaches={searchBeaches}
        onSelectSuggestion={handleSelectSuggestion}
      />
      <button
        type="button"
        onClick={handleLocateClick}
        aria-label={STRINGS.aria.myLocation}
        className={`br-press fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-60 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 sm:bottom-[calc(env(safe-area-inset-bottom)+120px)] ${
          followMode
            ? "border-sky-200/60 bg-sky-300/85 text-slate-950"
            : "border-white/12 bg-slate-950/60 text-slate-100"
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
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+130px)] z-40 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-100 shadow-lg backdrop-blur">
          {locationToast}
        </div>
      ) : null}
      {shareToast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+168px)] z-40 -translate-x-1/2 rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-[11px] text-sky-100 shadow-lg backdrop-blur">
          {shareToast}
        </div>
      ) : null}
      {isDebug && overrideCount > 0 ? (
        <div className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100 shadow-lg backdrop-blur">
          <div className="text-amber-100">
            {STRINGS.debug.overrideWarning(overrideCount)}
          </div>
        </div>
      ) : null}
      {isDebug && debugToast ? (
        <div className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-40 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[11px] text-emerald-100 shadow-lg backdrop-blur">
          {debugToast}
        </div>
      ) : null}
      {isDebug ? (
        <div className="fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-40 w-[min(92vw,320px)] rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>{STRINGS.debug.title}</span>
            <span className="text-[10px] text-slate-500">
              {STRINGS.debug.version}
            </span>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100">
            <span>{STRINGS.debug.editPositions}</span>
            <input
              type="checkbox"
              checked={editPositions}
              onChange={(event) => setEditPositions(event.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
          </label>
          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
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
          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
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
            className="mt-3 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {STRINGS.debug.resetOverride}
          </button>
          <button
            type="button"
            onClick={handleResetAllOverrides}
            disabled={overrideCount === 0}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {STRINGS.debug.resetOverrides}
          </button>
          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.attribution}</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-100">
              {debugAttribution
                ? JSON.stringify(debugAttribution)
                : STRINGS.debug.none}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            <div className="text-slate-500">{STRINGS.debug.eventsCount}</div>
            <div className="mt-1 text-slate-100">{debugEvents.length}</div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
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
            className="mt-3 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.copyExport}
          </button>
          <button
            type="button"
            onClick={handleClearEvents}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.clearEvents}
          </button>
          <button
            type="button"
            onClick={handleClearAttribution}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition"
          >
            {STRINGS.debug.clearAttribution}
          </button>
        </div>
      ) : null}
      <BottomSheet
        beaches={sortedBeaches}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        isOpen={sheetOpen}
        onToggle={handleToggleSheet}
        now={now}
      />
      {selectedBeach ? (
        <LidoModalCard
          beach={selectedBeach}
          isOpen={Boolean(selectedBeach)}
          now={now}
          onClose={handleCloseDrawer}
          onReport={handleOpenReport}
          onShare={handleShare}
        />
      ) : null}
      {selectedBeach ? (
        <ReportModal
          isOpen={reportOpen}
          beachName={selectedBeach.name}
          userLocation={userLocation}
          distanceM={reportDistanceM}
          geoStatus={geoStatus}
          geoError={geoError}
          onRequestLocation={requestLocation}
          onClose={handleCloseReport}
          onSubmit={handleSubmitReport}
          submitError={reportError}
        />
      ) : null}
    </div>
  );
}

export default App;
