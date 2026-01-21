import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvent } from "react-leaflet";
import L from "leaflet";
import type { BeachWithStats } from "../lib/types";
import type { LatLng } from "../lib/geo";

type Cluster = {
  id: string;
  lat: number;
  lng: number;
  beaches: BeachWithStats[];
  state: "live" | "recent" | "pred" | "mixed";
};

const CLUSTER_RADIUS_PX = 44;

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

const clusterBeaches = (beaches: BeachWithStats[], map: L.Map) => {
  const zoom = map.getZoom();
  const projected = beaches.map((beach) => ({
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

  return clusters;
};

type MapViewProps = {
  beaches: BeachWithStats[];
  selectedBeachId: string | null;
  onSelectBeach: (beachId: string) => void;
  center: LatLng;
};

const ClusteredMarkers = ({
  beaches,
  selectedBeachId,
  onSelectBeach,
}: Pick<MapViewProps, "beaches" | "selectedBeachId" | "onSelectBeach">) => {
  const map = useMap();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const markerRefs = useRef(new Map<string, L.Marker>());

  const rebuildClusters = useCallback(() => {
    setClusters(clusterBeaches(beaches, map));
  }, [beaches, map]);

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
          return (
            <Marker
              key={beach.id}
              position={[beach.lat, beach.lng]}
              icon={createMarkerIcon(
                beach.crowdLevel,
                beach.state,
                beach.id === selectedBeachId,
              )}
              eventHandlers={{
                click: () => onSelectBeach(beach.id),
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
                map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
              },
            }}
          />
        );
      })}
    </>
  );
};

const MapView = ({
  beaches,
  selectedBeachId,
  onSelectBeach,
  center,
}: MapViewProps) => (
  <MapContainer
    center={[center.lat, center.lng]}
    zoom={12}
    minZoom={10}
    maxZoom={18}
    zoomControl={false}
    className="h-full w-full"
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <ClusteredMarkers
      beaches={beaches}
      selectedBeachId={selectedBeachId}
      onSelectBeach={onSelectBeach}
    />
  </MapContainer>
);

export default MapView;
