import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Cluster = {
  id: string;
  lat: number;
  lng: number;
  beaches: BeachWithStats[];
  state: "live" | "recent" | "pred" | "mixed";
};

const CLUSTER_RADIUS_PX = 44;
const LOCATION_Z_INDEX = 1200;

const isValidCoord = (value: number) => Number.isFinite(value);
const hasValidCoords = (beach: BeachWithStats) =>
  isValidCoord(beach.lat) && isValidCoord(beach.lng);

const createMarkerIcon = (
  crowdLevel: number,
  state: "LIVE" | "RECENT" | "PRED",
  selected: boolean,
) =>
  L.divIcon({
    className: "",
    html: `<div class="beach-marker level-${crowdLevel} ${state.toLowerCase()}${
      selected ? " selected" : ""
    }">${crowdLevel}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

const getClusterState = (beaches: BeachWithStats[]): Cluster["state"] => {
  const states = new Set(beaches.map((beach) => beach.state));
  if (states.size === 1) {
    const [state] = Array.from(states);
    return state.toLowerCase() as Cluster["state"];
  }
  return "mixed";
};

const createClusterIcon = (cluster: Cluster) =>
  L.divIcon({
    className: "",
    html: `<div class="beach-cluster ${cluster.state}"><span class="cluster-prefix">x</span><span class="cluster-count">${cluster.beaches.length}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const clusterBeaches = (
  beaches: BeachWithStats[],
  map: L.Map,
  selectedBeachId?: string | null,
) => {
  const selected =
    selectedBeachId && beaches.find((beach) => beach.id === selectedBeachId);
  const rest = selected
    ? beaches.filter((beach) => beach.id !== selectedBeachId)
    : beaches;
  const zoom = map.getZoom();
  const projected = rest.map((beach) => ({
    beach,
    point: map.project([beach.lat, beach.lng], zoom),
  }));
  const visited = new Set<number>();
  const clusters: Cluster[] = [];

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

    const lat =
      members.reduce((sum, item) => sum + item.beach.lat, 0) / members.length;
    const lng =
      members.reduce((sum, item) => sum + item.beach.lng, 0) / members.length;
    const clusterItems = members.map((item) => item.beach);
    const clusterId =
      members.length === 1
        ? members[0].beach.id
        : `cluster-${members
            .map((item) => item.beach.id)
            .sort()
            .join("|")}`;

    clusters.push({
      id: clusterId,
      lat,
      lng,
      beaches: clusterItems,
      state: getClusterState(clusterItems),
    });
  }

  if (selected) {
    clusters.push({
      id: selected.id,
      lat: selected.lat,
      lng: selected.lng,
      beaches: [selected],
      state: getClusterState([selected]),
    });
  }

  return clusters;
};

type MapViewProps = {
  beaches: BeachWithStats[];
  selectedBeachId: string | null;
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
  onSelectBeach,
  editMode,
  onOverride,
}: Pick<
  MapViewProps,
  "beaches" | "selectedBeachId" | "onSelectBeach" | "editMode" | "onOverride"
>) => {
  const map = useMap();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const validBeaches = useMemo(
    () => beaches.filter((beach) => hasValidCoords(beach)),
    [beaches],
  );

  const rebuildClusters = useCallback(() => {
    setClusters(
      clusterBeaches(validBeaches, map, editMode ? selectedBeachId : null),
    );
  }, [editMode, map, selectedBeachId, validBeaches]);

  useEffect(() => {
    rebuildClusters();
  }, [rebuildClusters]);

  useMapEvent("zoomend", rebuildClusters);
  useMapEvent("moveend", rebuildClusters);

  useEffect(() => {
    markerRefs.current.forEach((marker, id) => {
      marker.setZIndexOffset(id === selectedBeachId ? 1000 : 0);
    });
  }, [selectedBeachId, clusters]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.beaches.length === 1) {
          const beach = cluster.beaches[0];
          const isSelected = beach.id === selectedBeachId;
          const isDraggable = Boolean(editMode && isSelected);
          return (
            <Marker
              key={beach.id}
              position={[beach.lat, beach.lng]}
              icon={createMarkerIcon(
                beach.crowdLevel,
                beach.state,
                isSelected,
              )}
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
        }

        return (
          <Marker
            key={cluster.id}
            position={[cluster.lat, cluster.lng]}
            icon={createClusterIcon(cluster)}
            eventHandlers={{
              click: () => {
                const bounds = L.latLngBounds(
                  cluster.beaches.map((beach) => [beach.lat, beach.lng]),
                );
                const maxZoom = map.getMaxZoom?.() ?? 18;
                const nextZoom = map.getBoundsZoom(bounds, false, [48, 48]);
                if (!Number.isFinite(nextZoom) || nextZoom <= map.getZoom()) {
                  map.setView(
                    [cluster.lat, cluster.lng],
                    Math.min(map.getZoom() + 2, maxZoom),
                    { animate: true },
                  );
                  return;
                }
                map.fitBounds(bounds, { padding: [48, 48], maxZoom });
              },
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
        pathOptions={{
          color: "#60a5fa",
          fillColor: "#60a5fa",
          fillOpacity: 0.18,
          weight: 1,
        }}
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

const MapView = ({
  beaches,
  selectedBeachId,
  onSelectBeach,
  center,
  editMode,
  onOverride,
  onMapReady,
  userLocation,
  onUserInteract,
}: MapViewProps) => (
  <MapContainer
    center={[center.lat, center.lng]}
    zoom={12}
    minZoom={10}
    maxZoom={18}
    zoomControl={false}
    bounceAtZoomLimits={false}
    className="h-full w-full"
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <MapViewportFix />
    <MapReady onReady={onMapReady} />
    <MapInteractionWatcher onUserInteract={onUserInteract} />
    <ClusteredMarkers
      beaches={beaches}
      selectedBeachId={selectedBeachId}
      onSelectBeach={onSelectBeach}
      editMode={editMode}
      onOverride={onOverride}
    />
    {userLocation ? <UserLocationLayer location={userLocation} /> : null}
  </MapContainer>
);

export default MapView;
