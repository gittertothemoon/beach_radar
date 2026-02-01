import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvent,
} from "react-leaflet";
import L from "leaflet";
import type { BeachWithStats } from "../lib/types";
import type { LatLng, UserLocation } from "../lib/geo";
import { createBeachPinIcon, createClusterPinDivIcon } from "../map/markerIcons";
import { isPerfEnabled, recordClusterStats, useRenderCounter } from "../lib/perf";

type Cluster = {
  id: string;
  lat: number;
  lng: number;
  members: {
    beach: BeachWithStats;
    lat: number;
    lng: number;
  }[];
  count: number;
  beachIds: string[];
  state: "live" | "recent" | "pred" | "mixed";
};

type SingleMarker = {
  id: string;
  beach: BeachWithStats;
  lat: number;
  lng: number;
  state: Cluster["state"];
};

const CLUSTER_RADIUS_PX = 18;
const DUPLICATE_SPREAD_MIN_ZOOM = 8;
const DUPLICATE_SPREAD_PX = 54;
const DUPLICATE_COORD_DP = 6;
const CLUSTER_SPIDERFY_PX = 64;
const CLUSTER_STACK_MAX_PX = 28;
const MAX_ZOOM_EPS = 0.05;
const Z_INDEX_CLUSTER = 2000;
const Z_INDEX_SELECTED = 1500;
const Z_INDEX_UMBRELLA = 1000;
const LOCATION_Z_INDEX = 900;
const WORLD_BOUNDS = L.latLngBounds(
  [-85.05112878, -180],
  [85.05112878, 180],
);
const USER_LOCATION_PATH_OPTIONS: L.PathOptions = {
  color: "#60a5fa",
  fillColor: "#60a5fa",
  fillOpacity: 0.18,
  weight: 1,
};

const isValidCoord = (value: number) => Number.isFinite(value);
const hasValidCoords = (beach: BeachWithStats) =>
  isValidCoord(beach.lat) && isValidCoord(beach.lng);
const getSafeZoom = (map: L.Map) => {
  const rawZoom = map.getZoom();
  const minZoom = map.getMinZoom?.() ?? 0;
  if (!Number.isFinite(rawZoom)) {
    return Number.isFinite(minZoom) ? minZoom : 0;
  }
  if (!Number.isFinite(minZoom)) return rawZoom;
  return Math.max(rawZoom, minZoom);
};

const getClusterPixelSpan = (points: L.Point[]) => {
  if (points.length === 0) return 0;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return Math.max(maxX - minX, maxY - minY);
};

const createMarkerIcon = (
  crowdLevel: number,
  state: "LIVE" | "RECENT" | "PRED",
  selected: boolean,
  zoom: number,
) => {
  return createBeachPinIcon({ selected, state, zoom, crowdLevel });
};

const getClusterState = (beaches: BeachWithStats[]): Cluster["state"] => {
  const states = new Set(beaches.map((beach) => beach.state));
  if (states.size === 1) {
    const [state] = Array.from(states);
    return state.toLowerCase() as Cluster["state"];
  }
  return "mixed";
};

const createClusterIcon = (cluster: Cluster, zoom: number) => {
  return createClusterPinDivIcon(cluster.count, zoom);
};

const buildDuplicateDisplayPositions = (
  beaches: BeachWithStats[],
  map: L.Map,
) => {
  const zoom = getSafeZoom(map);
  if (zoom < DUPLICATE_SPREAD_MIN_ZOOM) {
    return new Map<string, { lat: number; lng: number; point: L.Point }>();
  }

  const groups = new Map<string, BeachWithStats[]>();
  beaches.forEach((beach) => {
    const key = `${beach.lat.toFixed(DUPLICATE_COORD_DP)},${beach.lng.toFixed(
      DUPLICATE_COORD_DP,
    )}`;
    const group = groups.get(key);
    if (group) {
      group.push(beach);
    } else {
      groups.set(key, [beach]);
    }
  });

  const positions = new Map<string, { lat: number; lng: number; point: L.Point }>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const base = map.project([ordered[0].lat, ordered[0].lng], zoom);
    ordered.forEach((beach, index) => {
      const angle = (index / ordered.length) * Math.PI * 2;
      const offset = L.point(
        Math.cos(angle) * DUPLICATE_SPREAD_PX,
        Math.sin(angle) * DUPLICATE_SPREAD_PX,
      );
      const point = base.add(offset);
      const latlng = map.unproject(point, zoom);
      positions.set(beach.id, { lat: latlng.lat, lng: latlng.lng, point });
    });
  });

  return positions;
};

const clusterBeaches = (
  beaches: BeachWithStats[],
  map: L.Map,
  selectedBeachId?: string | null,
  allowDuplicateSpread = true,
  expandedClusters?: Set<string>,
) => {
  const selected =
    selectedBeachId && beaches.find((beach) => beach.id === selectedBeachId);
  const rest = selected
    ? beaches.filter((beach) => beach.id !== selectedBeachId)
    : beaches;
  const zoom = getSafeZoom(map);
  const maxZoom = map.getMaxZoom?.() ?? 18;
  const duplicatePositions = allowDuplicateSpread
    ? buildDuplicateDisplayPositions(beaches, map)
    : new Map<string, { lat: number; lng: number; point: L.Point }>();
  const projected = rest.map((beach) => {
    const display = duplicatePositions.get(beach.id);
    const lat = display?.lat ?? beach.lat;
    const lng = display?.lng ?? beach.lng;
    return {
      beach,
      lat,
      lng,
      point: display?.point ?? map.project([lat, lng], zoom),
    };
  });
  const visited = new Set<number>();
  const clusters: Cluster[] = [];
  const singles: SingleMarker[] = [];
  const addedSingles = new Set<string>();

  const pushSingle = (beach: BeachWithStats, lat: number, lng: number) => {
    if (addedSingles.has(beach.id)) return;
    addedSingles.add(beach.id);
    singles.push({
      id: beach.id,
      beach,
      lat,
      lng,
      state: getClusterState([beach]),
    });
  };

  for (let i = 0; i < projected.length; i += 1) {
    if (visited.has(i)) continue;
    const queue = [i];
    const members: typeof projected = [];
    visited.add(i);

    while (queue.length > 0) {
      const index = queue.pop() as number;
      const current = projected[index];
      members.push(current);

      for (let j = 0; j < projected.length; j += 1) {
        if (visited.has(j)) continue;
        if (current.point.distanceTo(projected[j].point) <= CLUSTER_RADIUS_PX) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    const lat = members.reduce((sum, item) => sum + item.lat, 0) / members.length;
    const lng = members.reduce((sum, item) => sum + item.lng, 0) / members.length;
    const clusterItems = members.map((item) => item.beach);
    const clusterId =
      members.length === 1
        ? members[0].beach.id
        : `cluster-${members
            .map((item) => item.beach.id)
            .sort()
            .join("|")}`;

    if (members.length > 1 && expandedClusters?.has(clusterId)) {
      const span = getClusterPixelSpan(members.map((item) => item.point));
      if (zoom >= maxZoom - MAX_ZOOM_EPS || span <= CLUSTER_STACK_MAX_PX) {
        const center = members
          .reduce((acc, item) => acc.add(item.point), L.point(0, 0))
          .divideBy(members.length);
        members.forEach((item, index) => {
          const angle = (index / members.length) * Math.PI * 2;
          const offset = L.point(
            Math.cos(angle) * CLUSTER_SPIDERFY_PX,
            Math.sin(angle) * CLUSTER_SPIDERFY_PX,
          );
          const point = center.add(offset);
          const latlng = map.unproject(point, zoom);
          pushSingle(item.beach, latlng.lat, latlng.lng);
        });
        continue;
      }
    }

    if (members.length === 1) {
      const only = members[0];
      pushSingle(only.beach, only.lat, only.lng);
      continue;
    }

    const beachIds = members.map((item) => item.beach.id);
    clusters.push({
      id: clusterId,
      lat,
      lng,
      members: members.map((item) => ({
        beach: item.beach,
        lat: item.lat,
        lng: item.lng,
      })),
      count: members.length,
      beachIds,
      state: getClusterState(clusterItems),
    });
  }

  if (selected) {
    const display = duplicatePositions.get(selected.id);
    const lat = display?.lat ?? selected.lat;
    const lng = display?.lng ?? selected.lng;
    pushSingle(selected, lat, lng);
  }

  return { clusters, singles };
};

type MapViewProps = {
  beaches: BeachWithStats[];
  selectedBeachId: string | null;
  soloBeachId?: string | null;
  onSelectBeach: (beachId: string) => void;
  center: LatLng;
  editMode?: boolean;
  onOverride?: (beachId: string, lat: number, lng: number) => void;
  onMapReady?: (map: L.Map) => void;
  userLocation?: UserLocation | null;
  onUserInteract?: () => void;
};

const ClusteredMarkers = ({
  beaches,
  selectedBeachId,
  soloBeachId,
  onSelectBeach,
  editMode,
  onOverride,
}: Pick<
  MapViewProps,
  | "beaches"
  | "selectedBeachId"
  | "soloBeachId"
  | "onSelectBeach"
  | "editMode"
  | "onOverride"
>) => {
  const map = useMap();
  const [mapTick, setMapTick] = useState(0);
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  const expandedClusterSet = useMemo(
    () => new Set(expandedClusters),
    [expandedClusters],
  );
  const markerRefs = useRef(new Map<string, L.Marker>());
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const lastClusterActionRef = useRef(0);
  const focusBeaches = useMemo(() => {
    if (!soloBeachId) return beaches;
    return beaches.filter((beach) => beach.id === soloBeachId);
  }, [beaches, soloBeachId]);
  const validBeaches = useMemo(
    () => focusBeaches.filter((beach) => hasValidCoords(beach)),
    [focusBeaches],
  );

  const zoom = useMemo(() => {
    // mapTick is a signal that the map state (center/bounds) changed.
    void mapTick;
    return getSafeZoom(map);
  }, [map, mapTick]);
  const selectedIdForClustering = editMode ? selectedBeachId : null;
  const perfEnabled = isPerfEnabled();

  const { clusters, singles } = useMemo(() => {
    // mapTick is a signal that the map state (center/bounds) changed.
    void mapTick;
    // eslint-disable-next-line react-hooks/purity -- dev-only timing instrumentation.
    const start = perfEnabled ? performance.now() : 0;
    const result = clusterBeaches(
      validBeaches,
      map,
      selectedIdForClustering,
      !editMode,
      expandedClusterSet,
    );
    if (perfEnabled) {
      recordClusterStats({
        // eslint-disable-next-line react-hooks/purity -- dev-only timing instrumentation.
        durationMs: performance.now() - start,
        zoom,
        clusterCount: result.clusters.length,
        singleCount: result.singles.length,
      });
    }
    return result;
  }, [
    validBeaches,
    map,
    selectedIdForClustering,
    editMode,
    expandedClusterSet,
    perfEnabled,
    zoom,
    mapTick,
  ]);

  const flushMapTick = useCallback(() => {
    setMapTick((prev) => prev + 1);
  }, []);

  const getOriginalEvent = (event?: L.LeafletEvent) =>
    (event as L.LeafletEvent & { originalEvent?: Event }).originalEvent;

  const handleClusterActivate = useCallback(
    (cluster: Cluster, event?: L.LeafletEvent) => {
      const originalEvent = getOriginalEvent(event);
      if (originalEvent && "preventDefault" in originalEvent) {
        originalEvent.preventDefault();
      }
      if (originalEvent && "stopPropagation" in originalEvent) {
        originalEvent.stopPropagation();
      }
      const now = Date.now();
      if (now - lastClusterActionRef.current < 320) return;
      lastClusterActionRef.current = now;

      map.stop();
      const padding = L.point(48, 48);
      const bounds = L.latLngBounds(
        cluster.members.map((member) => [member.lat, member.lng]),
      );
      const maxZoom = map.getMaxZoom?.() ?? 18;
      const currentZoom = map.getZoom();
      const isAtMax =
        Number.isFinite(currentZoom) && currentZoom >= maxZoom - MAX_ZOOM_EPS;
      const getZoomDuration = (targetZoom: number) => {
        const safeCurrent = Number.isFinite(currentZoom)
          ? currentZoom
          : targetZoom;
        const zoomDelta = Math.max(0, targetZoom - safeCurrent);
        return Math.min(3.2, Math.max(1.4, 0.8 + zoomDelta * 0.15));
      };
      const nextZoom = map.getBoundsZoom(bounds, false, padding);
      if (!Number.isFinite(nextZoom) || nextZoom <= currentZoom + 0.05) {
        if (isAtMax) {
          setExpandedClusters((prev) =>
            prev.includes(cluster.id) ? prev : [...prev, cluster.id],
          );
          return;
        }
        const targetZoom = Math.min(currentZoom + 2, maxZoom);
        if (targetZoom >= maxZoom - MAX_ZOOM_EPS) {
          setExpandedClusters((prev) =>
            prev.includes(cluster.id) ? prev : [...prev, cluster.id],
          );
        }
        map.flyTo([cluster.lat, cluster.lng], targetZoom, {
          animate: true,
          duration: getZoomDuration(targetZoom),
          easeLinearity: 0.25,
        });
        return;
      }
      const targetZoom = Math.min(nextZoom, maxZoom);
      if (targetZoom >= maxZoom - MAX_ZOOM_EPS) {
        setExpandedClusters((prev) =>
          prev.includes(cluster.id) ? prev : [...prev, cluster.id],
        );
      }
      map.fitBounds(bounds, {
        padding,
        maxZoom,
        animate: true,
        duration: getZoomDuration(targetZoom),
        easeLinearity: 0.25,
      });
    },
    [map],
  );

  const scheduleMapTick = useCallback(() => {
    pendingRef.current = true;
    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        if (!pendingRef.current) return;
        pendingRef.current = false;
        flushMapTick();
      });
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      if (!pendingRef.current) return;
      pendingRef.current = false;
      flushMapTick();
    }, 80);
  }, [flushMapTick]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  useMapEvent("zoomend", scheduleMapTick);
  useMapEvent("moveend", scheduleMapTick);
  useMapEvent("zoomend", () => {
    const maxZoom = map.getMaxZoom?.() ?? 18;
    const currentZoom = map.getZoom();
    const atMax =
      Number.isFinite(currentZoom) && currentZoom >= maxZoom - MAX_ZOOM_EPS;
    if (!atMax && expandedClusters.length) {
      setExpandedClusters([]);
    }
  });

  useEffect(() => {
    markerRefs.current.forEach((marker, id) => {
      marker.setZIndexOffset(
        id === selectedBeachId ? Z_INDEX_SELECTED : Z_INDEX_UMBRELLA,
      );
    });
  }, [selectedBeachId, singles.length]);

  return (
    <>
      {clusters.map((cluster) => (
        <Marker
          key={cluster.id}
          position={[cluster.lat, cluster.lng]}
          icon={createClusterIcon(cluster, zoom)}
          zIndexOffset={Z_INDEX_CLUSTER}
          eventHandlers={{
            click: (event) => handleClusterActivate(cluster, event),
          }}
        />
      ))}
      {singles.map((single) => {
        const beach = single.beach;
        const isSelected = beach.id === selectedBeachId;
        const isDraggable = Boolean(editMode && isSelected);
        return (
          <Marker
            key={beach.id}
            position={[single.lat, single.lng]}
            icon={createMarkerIcon(
              beach.crowdLevel,
              beach.state,
              isSelected,
              zoom,
            )}
            zIndexOffset={isSelected ? Z_INDEX_SELECTED : Z_INDEX_UMBRELLA}
            draggable={isDraggable}
            eventHandlers={{
              click: () => onSelectBeach(beach.id),
              ...(isDraggable && onOverride
                ? {
                    dragend: (event) => {
                      const marker = event.target as L.Marker;
                      const { lat, lng } = marker.getLatLng();
                      onOverride(beach.id, lat, lng);
                    },
                  }
                : {}),
            }}
            ref={(marker) => {
              if (marker) {
                markerRefs.current.set(beach.id, marker);
              } else {
                markerRefs.current.delete(beach.id);
              }
            }}
          />
        );
      })}
    </>
  );
};

const MapViewportFix = () => {
  const map = useMap();

  useEffect(() => {
    let zooming = false;
    let pending = false;
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    const runInvalidate = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      rafId = window.requestAnimationFrame(() =>
        map.invalidateSize({ animate: false }),
      );
      timeoutId = window.setTimeout(() => {
        map.invalidateSize({ animate: false });
      }, 250);
    };

    const scheduleInvalidate = () => {
      if (zooming) {
        pending = true;
        return;
      }
      runInvalidate();
    };

    const handleZoomStart = () => {
      zooming = true;
    };

    const handleZoomEnd = () => {
      zooming = false;
      if (pending) {
        pending = false;
        runInvalidate();
      }
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem("br_debug_v1") === "1"
      ) {
        console.info("[br] zoomend", map.getZoom());
      }
    };

    map.on("zoomstart", handleZoomStart);
    map.on("zoomend", handleZoomEnd);
    scheduleInvalidate();
    window.addEventListener("resize", scheduleInvalidate);
    window.addEventListener("orientationchange", scheduleInvalidate);
    window.addEventListener("visibilitychange", scheduleInvalidate);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", scheduleInvalidate);

    return () => {
      map.off("zoomstart", handleZoomStart);
      map.off("zoomend", handleZoomEnd);
      window.removeEventListener("resize", scheduleInvalidate);
      window.removeEventListener("orientationchange", scheduleInvalidate);
      window.removeEventListener("visibilitychange", scheduleInvalidate);
      visualViewport?.removeEventListener("resize", scheduleInvalidate);
    };
  }, [map]);

  return null;
};

const userLocationIcon = L.divIcon({
  className: "",
  html: '<div class="user-location-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const UserLocationLayer = ({ location }: { location: UserLocation }) => {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return null;
  }

  return (
    <>
      <Circle
        center={[location.lat, location.lng]}
        radius={location.accuracy}
        pathOptions={USER_LOCATION_PATH_OPTIONS}
      />
      <Marker
        position={[location.lat, location.lng]}
        icon={userLocationIcon}
        zIndexOffset={LOCATION_Z_INDEX}
        interactive={false}
      />
    </>
  );
};

const MapInteractionWatcher = ({
  onUserInteract,
}: {
  onUserInteract?: () => void;
}) => {
  const getOriginalEvent = (event: L.LeafletEvent) =>
    (event as L.LeafletEvent & { originalEvent?: Event }).originalEvent;

  useMapEvent("dragstart", (event) => {
    if (!getOriginalEvent(event)) return;
    onUserInteract?.();
  });
  useMapEvent("zoomstart", (event) => {
    if (!getOriginalEvent(event)) return;
    onUserInteract?.();
  });
  return null;
};

const MapReady = ({ onReady }: { onReady?: (map: L.Map) => void }) => {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);

  return null;
};

const MapViewComponent = ({
  beaches,
  selectedBeachId,
  soloBeachId,
  onSelectBeach,
  center,
  editMode,
  onOverride,
  onMapReady,
  userLocation,
  onUserInteract,
}: MapViewProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("MapView", perfEnabled);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      minZoom={2}
      maxZoom={18}
      fadeAnimation={false}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      zoomControl={false}
      bounceAtZoomLimits={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        minZoom={2}
        maxZoom={18}
        updateWhenIdle={false}
        updateWhenZooming
        updateInterval={30}
        keepBuffer={8}
        noWrap
        bounds={WORLD_BOUNDS}
      />
      <MapViewportFix />
      <MapReady onReady={onMapReady} />
      <MapInteractionWatcher onUserInteract={onUserInteract} />
      <ClusteredMarkers
        beaches={beaches}
        selectedBeachId={selectedBeachId}
        soloBeachId={soloBeachId}
        onSelectBeach={onSelectBeach}
        editMode={editMode}
        onOverride={onOverride}
      />
      {userLocation ? <UserLocationLayer location={userLocation} /> : null}
    </MapContainer>
  );
};

const MapView = memo(MapViewComponent);

export default MapView;
