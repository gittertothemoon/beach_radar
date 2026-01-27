import L from "leaflet";
import beachPin from "../assets/markers/pin_beach.png";
import clusterPin from "../assets/markers/pin_cluster.png";

type BeachPinOptions = {
  selected?: boolean;
  state?: "LIVE" | "RECENT" | "PRED";
};

const BEACH_PIN_SIZE = 64;
const BEACH_PIN_SELECTED_SIZE = 70;
const CLUSTER_PIN_SIZE = 72;

const beachPinCache = new Map<string, L.Icon>();
const clusterPinCache = new Map<string, L.DivIcon>();

const getBeachPinKey = ({ selected, state }: BeachPinOptions) =>
  `${selected ? "selected" : "normal"}|${state ?? "LIVE"}`;

export const createBeachPinIcon = (options: BeachPinOptions = {}) => {
  const key = getBeachPinKey(options);
  const cached = beachPinCache.get(key);
  if (cached) return cached;

  const isSelected = Boolean(options.selected);
  const isPred = options.state === "PRED";
  const size = isSelected ? BEACH_PIN_SELECTED_SIZE : BEACH_PIN_SIZE;
  const className = [
    "br-beach-pin",
    isSelected ? "br-beach-pin--selected" : "",
    isPred ? "br-beach-pin--pred" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const icon = L.icon({
    iconUrl: beachPin,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    className,
  });

  beachPinCache.set(key, icon);
  return icon;
};

export const createClusterPinDivIcon = (count: number) => {
  const safeCount = Math.max(1, Math.round(count));
  const key = String(safeCount);
  const cached = clusterPinCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "",
    html: `<div class="br-cluster-pin"><img class="br-cluster-img" src="${clusterPin}" alt="" loading="eager" decoding="async" /><span class="br-cluster-count">x${safeCount}</span></div>`,
    iconSize: [CLUSTER_PIN_SIZE, CLUSTER_PIN_SIZE],
    iconAnchor: [CLUSTER_PIN_SIZE / 2, CLUSTER_PIN_SIZE],
  });

  clusterPinCache.set(key, icon);
  return icon;
};

