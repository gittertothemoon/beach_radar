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
import {
  createBeachPinIcon,
  createClusterPinDivIcon,
} from "../map/markerIcons";
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
const CLUSTER_CLICK_DEBOUNCE_MS = 240;
const CLUSTER_FORCE_EXPAND_MS = 4000;
const CLUSTER_FORCE_EXPAND_DISTANCE_PX = 56;
const CLUSTER_FORCE_ZOOM_STEP = 3;
const CLUSTER_FIRST_TAP_MIN_ZOOM_STEP = 3;
const CLUSTER_FLY_MIN_DURATION_S = 1.8;
const CLUSTER_FLY_MAX_DURATION_S = 3.4;
const CLUSTER_FLY_BASE_DURATION_S = 1.0;
const CLUSTER_FLY_STEP_DURATION_S = 0.2;
const CLUSTER_FLY_EASE_LINEARITY = 0.2;
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

const createMarkerIcon = (
  crowdLevel: number,
  state: "LIVE" | "RECENT" | "PRED",
  favorite: boolean,
  selected: boolean,
  zoom: number,
) => {
  return createBeachPinIcon({ selected, state, zoom, crowdLevel, favorite });
};

const getClusterState = (beaches: BeachWithStats[]): Cluster["state"] => {
  const states = new Set(beaches.map((beach) => beach.state));
  if (states.size === 1) {
    const [state] = Array.from(states);
    return state.toLowerCase() as Cluster["state"];
  }
  return "mixed";
};

const createClusterIcon = (_cluster: Cluster, zoom: number) => {
  return createClusterPinDivIcon(_cluster.count, zoom);
};

const clusterBeaches = (
  beaches: BeachWithStats[],
  map: L.Map,
  favoriteBeachIds: Set<string>,
  selectedBeachId?: string | null,
) => {
  const selected =
    selectedBeachId && beaches.find((beach) => beach.id === selectedBeachId);
  const favorites = beaches.filter(
    (beach) => favoriteBeachIds.has(beach.id) && beach.id !== selectedBeachId,
  );
  const rest = selected
    ? beaches.filter(
        (beach) =>
          beach.id !== selectedBeachId && !favoriteBeachIds.has(beach.id),
      )
    : beaches.filter((beach) => !favoriteBeachIds.has(beach.id));
  const zoom = getSafeZoom(map);
  const projected = rest.map((beach) => {
    return {
      beach,
      lat: beach.lat,
      lng: beach.lng,
      point: map.project([beach.lat, beach.lng], zoom),
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
    pushSingle(selected, selected.lat, selected.lng);
  }
  for (const favorite of favorites) {
    pushSingle(favorite, favorite.lat, favorite.lng);
  }

  return { clusters, singles };
};

type MapViewProps = {
  beaches: BeachWithStats[];
  favoriteBeachIds: Set<string>;
  selectedBeachId: string | null;
  onSelectBeach: (beachId: string) => void;
  center: LatLng;
  initialZoom?: number;
  editMode?: boolean;
  onOverride?: (beachId: string, lat: number, lng: number) => void;
  onMapReady?: (map: L.Map) => void;
  userLocation?: UserLocation | null;
  onUserInteract?: () => void;
};

const ClusteredMarkers = ({
  beaches,
  favoriteBeachIds,
  selectedBeachId,
  onSelectBeach,
  editMode,
  onOverride,
}: Pick<
  MapViewProps,
  | "beaches"
  | "favoriteBeachIds"
  | "selectedBeachId"
  | "onSelectBeach"
  | "editMode"
  | "onOverride"
>) => {
  const map = useMap();
  const [mapTick, setMapTick] = useState(0);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const lastClusterActionRef = useRef<{
    id: string;
    at: number;
    lat: number;
    lng: number;
    count: number;
  }>({
    id: "",
    at: 0,
    lat: 0,
    lng: 0,
    count: 0,
  });
  const validBeaches = useMemo(
    () => beaches.filter((beach) => hasValidCoords(beach)),
    [beaches],
  );

  const zoom = useMemo(() => {
    // mapTick is a signal that the map state (center/bounds) changed.
    void mapTick;
    return getSafeZoom(map);
  }, [map, mapTick]);
  const selectedIdForClustering = selectedBeachId;
  const perfEnabled = isPerfEnabled();

  const { clusters, singles } = useMemo(() => {
    // mapTick is a signal that the map state (center/bounds) changed.
    void mapTick;
    // eslint-disable-next-line react-hooks/purity -- dev-only timing instrumentation.
    const start = perfEnabled ? performance.now() : 0;
    const result = clusterBeaches(
      validBeaches,
      map,
      favoriteBeachIds,
      selectedIdForClustering,
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
    favoriteBeachIds,
    selectedIdForClustering,
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
      const last = lastClusterActionRef.current;
      const hasLast = last.at > 0;
      const currentPoint = map.latLngToContainerPoint([cluster.lat, cluster.lng]);
      const lastPoint = map.latLngToContainerPoint([last.lat, last.lng]);
      const sameClusterIntent =
        hasLast &&
        (last.id === cluster.id ||
          (last.count === cluster.count &&
            currentPoint.distanceTo(lastPoint) <= CLUSTER_FORCE_EXPAND_DISTANCE_PX));

      if (sameClusterIntent && now - last.at < CLUSTER_CLICK_DEBOUNCE_MS) return;

      lastClusterActionRef.current = {
        id: cluster.id,
        at: now,
        lat: cluster.lat,
        lng: cluster.lng,
        count: cluster.count,
      };

      if (sameClusterIntent && now - last.at < CLUSTER_FORCE_EXPAND_MS) {
        map.stop();
        const maxZoom = map.getMaxZoom?.() ?? 18;
        const currentZoom = map.getZoom();
        const targetZoom = Math.min(currentZoom + CLUSTER_FORCE_ZOOM_STEP, maxZoom);
        const safeCurrent = Number.isFinite(currentZoom) ? currentZoom : targetZoom;
        const zoomDelta = Math.max(0, targetZoom - safeCurrent);
        const duration = Math.min(
          CLUSTER_FLY_MAX_DURATION_S,
          Math.max(
            CLUSTER_FLY_MIN_DURATION_S,
            CLUSTER_FLY_BASE_DURATION_S + zoomDelta * CLUSTER_FLY_STEP_DURATION_S,
          ),
        );
        map.flyTo([cluster.lat, cluster.lng], targetZoom, {
          animate: true,
          duration,
          easeLinearity: CLUSTER_FLY_EASE_LINEARITY,
        });
        return;
      }

      map.stop();
      const padding = L.point(48, 48);
      const bounds = L.latLngBounds(
        cluster.members.map((member) => [member.lat, member.lng]),
      );
      const maxZoom = map.getMaxZoom?.() ?? 18;
      const currentZoom = map.getZoom();
      const getZoomDuration = (targetZoom: number) => {
        const safeCurrent = Number.isFinite(currentZoom)
          ? currentZoom
          : targetZoom;
        const zoomDelta = Math.max(0, targetZoom - safeCurrent);
        return Math.min(
          CLUSTER_FLY_MAX_DURATION_S,
          Math.max(
            CLUSTER_FLY_MIN_DURATION_S,
            CLUSTER_FLY_BASE_DURATION_S + zoomDelta * CLUSTER_FLY_STEP_DURATION_S,
          ),
        );
      };
      const nextZoom = map.getBoundsZoom(bounds, false, padding);
      const safeNextZoom = Number.isFinite(nextZoom) ? nextZoom : currentZoom;
      const firstTapStep =
        cluster.count >= 80
          ? CLUSTER_FIRST_TAP_MIN_ZOOM_STEP + 1
          : CLUSTER_FIRST_TAP_MIN_ZOOM_STEP;
      const targetZoom = Math.min(
        maxZoom,
        Math.max(safeNextZoom, currentZoom + firstTapStep),
      );
      map.flyTo([cluster.lat, cluster.lng], targetZoom, {
        animate: true,
        duration: getZoomDuration(targetZoom),
        easeLinearity: CLUSTER_FLY_EASE_LINEARITY,
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
              favoriteBeachIds.has(beach.id),
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
  favoriteBeachIds,
  selectedBeachId,
  onSelectBeach,
  center,
  initialZoom = 12,
  editMode,
  onOverride,
  onMapReady,
  userLocation,
  onUserInteract,
}: MapViewProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("MapView", perfEnabled);

  return (
    <div data-testid="map-container" className="h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
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
          favoriteBeachIds={favoriteBeachIds}
          selectedBeachId={selectedBeachId}
          onSelectBeach={onSelectBeach}
          editMode={editMode}
          onOverride={onOverride}
        />
        {userLocation ? <UserLocationLayer location={userLocation} /> : null}
      </MapContainer>
    </div>
  );
};

const MapView = memo(MapViewComponent);

export default MapView;
