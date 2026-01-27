import L from "leaflet";
import beachPin from "../assets/markers/pin_beach.png";
import clusterPin from "../assets/markers/pin_cluster.png";

type BeachPinOptions = {
  selected?: boolean;
  state?: "LIVE" | "RECENT" | "PRED";
  zoom: number;
};

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

const getRoundedZoom = (zoom: number) =>
  Number.isFinite(zoom) ? Math.round(zoom) : 12;

const UMBRELLA_MIN_SIZE = 20;
const UMBRELLA_MAX_SIZE = 40;
const CLUSTER_MIN_SIZE = 32;
const CLUSTER_MAX_SIZE = 48;
const CLUSTER_LABEL_TOP_PERCENT = 42;

const getUmbrellaSizeForZoom = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 12) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 22);
  if (z <= 14) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 26);
  if (z <= 16) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 32);
  return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 38);
};

const getClusterSizeForZoom = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 10) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 44);
  if (z <= 13) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 40);
  if (z <= 16) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 36);
  return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 34);
};

const getClusterDigitScale = (digitCount: number) => {
  if (digitCount === 1) return 1.05;
  if (digitCount === 2) return 1;
  if (digitCount === 3) return 0.9;
  return 0.82;
};

const beachPinCache = new Map<string, L.Icon>();
const clusterPinCache = new Map<string, L.DivIcon>();

const getUmbrellaKey = ({ selected, state, zoom }: BeachPinOptions) => {
  const size = getUmbrellaSizeForZoom(zoom);
  return `${size}|${selected ? "selected" : "normal"}|${state ?? "LIVE"}`;
};

export const createBeachPinIcon = (options: BeachPinOptions) => {
  const key = getUmbrellaKey(options);
  const cached = beachPinCache.get(key);
  if (cached) return cached;

  const isSelected = Boolean(options.selected);
  const isPred = options.state === "PRED";
  const baseSize = getUmbrellaSizeForZoom(options.zoom);
  const size = isSelected ? Math.round(baseSize * 1.08) : baseSize;
  const anchorX = Math.round(size * 0.5);
  const anchorY = Math.round(size * 0.8);
  const popupAnchorY = -Math.round(size * 0.65);
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
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, popupAnchorY],
    className,
  });

  beachPinCache.set(key, icon);
  return icon;
};

export const createClusterPinDivIcon = (count: number, zoom: number) => {
  const safeCount = Math.max(1, Math.round(count));
  const digitCount = String(safeCount).length;
  const size = getClusterSizeForZoom(zoom);
  const digitScale = getClusterDigitScale(digitCount);
  const baseFontSize = size * 0.34;
  const fontSize = Math.round(
    clamp(11, size * 0.38, baseFontSize * digitScale),
  );
  const key = `${size}|${digitCount}|${safeCount}|${fontSize}`;
  const cached = clusterPinCache.get(key);
  if (cached) return cached;

  const anchorX = Math.round(size * 0.5);
  const anchorY = Math.round(size * 0.92);
  const popupAnchorY = -Math.round(size * 0.75);

  const icon = L.divIcon({
    className: "",
    html: `<div class="br-cluster" style="--s:${size}px"><img class="br-cluster__img" src="${clusterPin}" alt="" loading="eager" decoding="async" /><span class="br-cluster__label" style="--label-top:${CLUSTER_LABEL_TOP_PERCENT}%;--fs:${fontSize}px"><span class="br-cluster__x">x</span><span class="br-cluster__n">${safeCount}</span></span></div>`,
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, popupAnchorY],
  });

  clusterPinCache.set(key, icon);
  return icon;
};
