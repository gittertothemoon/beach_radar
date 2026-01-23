import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import MapView from "../components/MapView";
import TopSearch from "../components/TopSearch";
import BottomSheet from "../components/BottomSheet";
import LidoModalCard from "../components/LidoModalCard";
import ReportModal from "../components/ReportModal";
import { shareBeachCard } from "../components/ShareCard";
import logo from "../assets/logo.png";
import logoText from "../assets/beach-radar-scritta.png";
import splashBg from "../assets/initial-bg.png";
import { SPOTS } from "../data/spots";
import { STRINGS } from "../i18n/it";
import { aggregateBeachStats } from "../lib/aggregate";
import { distanceInMeters } from "../lib/geo";
import {
  clearOverride,
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
import type { BeachWithStats, CrowdLevel, Report } from "../lib/types";
import type { LatLng, UserLocation } from "../lib/geo";
import type { BeachOverrides } from "../lib/overrides";

const DEFAULT_CENTER: LatLng = { lat: 44.0678, lng: 12.5695 };
const BEACH_FOCUS_ZOOM = 17;

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "error";

function App() {
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>(() =>
    typeof window === "undefined" ? [] : loadReports(),
  );
  const [now, setNow] = useState(Date.now());
  const [overrides, setOverrides] = useState<BeachOverrides>(() =>
    typeof window === "undefined" ? {} : loadOverrides(),
  );
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [editPositions, setEditPositions] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [debugToast, setDebugToast] = useState<string | null>(null);
  const [splashPhase, setSplashPhase] = useState<
    "visible" | "fading" | "hidden"
  >("visible");
  const mapRef = useRef<LeafletMap | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const followInitializedRef = useRef(false);
  const followModeRef = useRef(false);
  const lastLocateTapRef = useRef(0);

  const isDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname.startsWith("/debug") ||
      window.localStorage.getItem("br_debug_v1") === "1"
    );
  }, []);

  const effectiveEditMode = isDebug && editPositions;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const fadeTimeout = window.setTimeout(() => {
      setSplashPhase("fading");
    }, 1700);
    const hideTimeout = window.setTimeout(() => {
      setSplashPhase("hidden");
    }, 2000);
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

  const beachViews = useMemo<BeachWithStats[]>(() => {
    return SPOTS.map((beach) => {
      const override = overrides[beach.id];
      const lat = override?.lat ?? beach.lat;
      const lng = override?.lng ?? beach.lng;
      const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const stats = aggregateBeachStats(beach, reports, now);
      const distanceM = userLocation
        ? hasValidCoords
          ? distanceInMeters(userLocation, { lat, lng })
          : null
        : null;
      return { ...beach, lat, lng, ...stats, distanceM };
    });
  }, [overrides, reports, now, userLocation]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBeaches = useMemo(() => {
    if (!normalizedSearch) return beachViews;
    return beachViews.filter(
      (beach) =>
        beach.name.toLowerCase().includes(normalizedSearch) ||
        beach.region.toLowerCase().includes(normalizedSearch),
    );
  }, [beachViews, normalizedSearch]);

  const liveDataNotice = useMemo(() => {
    const total = beachViews.length;
    if (total === 0) return null;
    let predCount = 0;
    beachViews.forEach((beach) => {
      if (beach.state === "PRED") predCount += 1;
    });
    return predCount / total >= 0.85 ? STRINGS.banners.limitedData : null;
  }, [beachViews]);

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

  const selectedBeach = beachViews.find(
    (beach) => beach.id === selectedBeachId,
  );
  const selectedOverride = selectedBeachId ? overrides[selectedBeachId] : null;

  useEffect(() => {
    if (selectedBeachId && !selectedBeach) {
      setSelectedBeachId(null);
    }
  }, [selectedBeach, selectedBeachId]);

  const focusBeach = useCallback(
    (beachId: string, options?: { updateSearch?: boolean }) => {
      const beach = beachViews.find((item) => item.id === beachId);
      if (!beach) return;
      if (options?.updateSearch) {
        setSearch(beach.name);
      }
      setSelectedBeachId(beach.id);
      setSheetOpen(false);
      const map = mapRef.current;
      if (map && Number.isFinite(beach.lat) && Number.isFinite(beach.lng)) {
        const offsetY = Math.round(map.getSize().y * 0.25);
        map.once("moveend", () => {
          if (offsetY) {
            map.panBy([0, -offsetY], { animate: true });
          }
        });
        map.flyTo([beach.lat, beach.lng], BEACH_FOCUS_ZOOM, { animate: true });
      }
    },
    [beachViews],
  );

  const handleSelectBeach = useCallback(
    (beachId: string) => {
      focusBeach(beachId);
    },
    [focusBeach],
  );

  const handleSelectSuggestion = useCallback(
    (beachId: string) => {
      focusBeach(beachId, { updateSearch: true });
    },
    [focusBeach],
  );

  const handleCloseDrawer = () => {
    if (reportOpen) return;
    setSelectedBeachId(null);
  };

  const handleSubmitReport = (level: CrowdLevel) => {
    if (!selectedBeach) return;
    const reporterHash = getReporterHash();
    const result = tryAddReport({
      beachId: selectedBeach.id,
      crowdLevel: level,
      reporterHash,
    });
    if (result.ok) {
      setReports(result.reports);
      setNow(Date.now());
      setReportError(null);
      setReportOpen(false);
    } else {
      setReportError(result.reason);
    }
  };

  const handleShare = async () => {
    if (!selectedBeach) return;
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
    }
  };

  const firstBeach = beachViews.find(
    (beach) => Number.isFinite(beach.lat) && Number.isFinite(beach.lng),
  );
  const mapCenter = firstBeach
    ? { lat: firstBeach.lat, lng: firstBeach.lng }
    : DEFAULT_CENTER;

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
          <img src={logoText} alt="Beach Radar" className="-mt-36 h-64 w-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapView
        beaches={filteredBeaches}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        center={mapCenter}
        editMode={effectiveEditMode}
        onOverride={handleOverride}
        onMapReady={(map) => {
          mapRef.current = map;
        }}
        userLocation={userLocation ?? undefined}
        onUserInteract={handleUserInteract}
      />
      <TopSearch
        value={search}
        onChange={setSearch}
        resultCount={filteredBeaches.length}
        notice={liveDataNotice}
        beaches={beachViews}
        onSelectSuggestion={handleSelectSuggestion}
      />
      <button
        type="button"
        onClick={handleLocateClick}
        aria-label={STRINGS.aria.myLocation}
        className={`fixed right-4 top-[calc(env(safe-area-inset-top)+78px)] z-30 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
          followMode
            ? "border-sky-300/80 bg-sky-300 text-slate-950"
            : "border-slate-800/80 bg-slate-950/80 text-slate-100"
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
        </div>
      ) : null}
      <BottomSheet
        beaches={sortedBeaches}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        isOpen={sheetOpen}
        onToggle={() => setSheetOpen((prev) => !prev)}
        now={now}
      />
      {selectedBeach ? (
        <LidoModalCard
          beach={selectedBeach}
          isOpen={Boolean(selectedBeach)}
          now={now}
          onClose={handleCloseDrawer}
          onReport={() => {
            setReportOpen(true);
            setReportError(null);
          }}
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
          onClose={() => {
            setReportOpen(false);
            setReportError(null);
          }}
          onSubmit={handleSubmitReport}
          submitError={reportError}
        />
      ) : null}
    </div>
  );
}

export default App;
