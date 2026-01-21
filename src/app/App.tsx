import { useEffect, useMemo, useState } from "react";
import MapView from "../components/MapView";
import TopSearch from "../components/TopSearch";
import BottomSheet from "../components/BottomSheet";
import BeachDrawer from "../components/BeachDrawer";
import ReportModal from "../components/ReportModal";
import { shareBeachCard } from "../components/ShareCard";
import { beaches } from "../data/beaches.seed";
import { aggregateBeachStats } from "../lib/aggregate";
import { distanceInMeters } from "../lib/geo";
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
import type { LatLng } from "../lib/geo";

const DEFAULT_CENTER: LatLng = { lat: 44.0678, lng: 12.5695 };

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "error";

function App() {
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>(() =>
    typeof window === "undefined" ? [] : loadReports(),
  );
  const [now, setNow] = useState(Date.now());
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setGeoError("Geolocalizzazione non supportata.");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus("ready");
        setGeoError(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus("denied");
          setGeoError("Permesso negato.");
        } else {
          setGeoStatus("error");
          setGeoError("Errore nel recupero posizione.");
        }
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const beachViews = useMemo<BeachWithStats[]>(() => {
    return beaches.map((beach) => {
      const stats = aggregateBeachStats(beach, reports, now);
      const distanceM = userLocation
        ? distanceInMeters(userLocation, { lat: beach.lat, lng: beach.lng })
        : null;
      return { ...beach, ...stats, distanceM };
    });
  }, [reports, now, userLocation]);

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
    return predCount / total >= 0.85 ? "contribuisci con un report" : null;
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

  useEffect(() => {
    if (selectedBeachId && !selectedBeach) {
      setSelectedBeachId(null);
    }
  }, [selectedBeach, selectedBeachId]);

  const handleSelectBeach = (beachId: string) => {
    setSelectedBeachId(beachId);
    setSheetOpen(false);
  };

  const handleCloseDrawer = () => setSelectedBeachId(null);

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

  const mapCenter = beaches[0]
    ? { lat: beaches[0].lat, lng: beaches[0].lng }
    : DEFAULT_CENTER;

  const reportDistanceM =
    selectedBeach && userLocation
      ? distanceInMeters(userLocation, {
          lat: selectedBeach.lat,
          lng: selectedBeach.lng,
        })
      : null;

  return (
    <div className="relative h-full w-full">
      <MapView
        beaches={filteredBeaches}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        center={mapCenter}
      />
      <TopSearch
        value={search}
        onChange={setSearch}
        resultCount={filteredBeaches.length}
        notice={liveDataNotice}
      />
      <BottomSheet
        beaches={sortedBeaches}
        selectedBeachId={selectedBeachId}
        onSelectBeach={handleSelectBeach}
        isOpen={sheetOpen}
        onToggle={() => setSheetOpen((prev) => !prev)}
        now={now}
      />
      {selectedBeach ? (
        <BeachDrawer
          beach={selectedBeach}
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
