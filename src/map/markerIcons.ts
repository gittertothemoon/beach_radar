import L from "leaflet";
import beachPinEmpty from "../assets/markers/pin_beach.png";
import beachPinLow from "../assets/markers/pin_beach_poco_affollata.png";
import beachPinCrowded from "../assets/markers/pin_beach_affollata.png";
import beachPinFull from "../assets/markers/pin_beach_piena.png";
import clusterPin from "../assets/markers/pin_cluster.png";
import {
  isPerfEnabled,
  recordTiming,
  setMarkerIconCacheSize,
} from "../lib/perf";

type BeachPinOptions = {
  selected?: boolean;
  favorite?: boolean;
  state?: "LIVE" | "RECENT" | "PRED";
  crowdLevel?: number;
  zoom: number;
};

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

const getRoundedZoom = (zoom: number) =>
  Number.isFinite(zoom) ? Math.round(zoom) : 12;

const UMBRELLA_MIN_SIZE = 20;
const UMBRELLA_MAX_SIZE = 40;
const CLUSTER_MIN_SIZE = 36;
const CLUSTER_MAX_SIZE = 56;
const getUmbrellaSizeForZoom = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 12) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 22);
  if (z <= 14) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 26);
  if (z <= 16) return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 32);
  return clamp(UMBRELLA_MIN_SIZE, UMBRELLA_MAX_SIZE, 38);
};

const getClusterSizeForZoom = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 10) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 52);
  if (z <= 13) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 48);
  if (z <= 16) return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 44);
  return clamp(CLUSTER_MIN_SIZE, CLUSTER_MAX_SIZE, 40);
};

const getClusterDigitScale = (digitCount: number) => {
  if (digitCount === 1) return 1.05;
  if (digitCount === 2) return 1;
  if (digitCount === 3) return 0.9;
  return 0.82;
};

const beachPinCache = new Map<string, L.DivIcon>();
const clusterPinCache = new Map<string, L.DivIcon>();

const updateCacheSizeStat = () => {
  if (!isPerfEnabled()) return;
  setMarkerIconCacheSize(beachPinCache.size + clusterPinCache.size);
};

const normalizeCrowdLevel = (level?: number) => {
  const rounded = Math.round(Number(level));
  if (rounded === 1 || rounded === 2 || rounded === 3 || rounded === 4) {
    return rounded;
  }
  return 1;
};

const getUmbrellaKey = ({
  selected,
  favorite,
  state,
  zoom,
  crowdLevel,
}: BeachPinOptions) => {
  const size = getUmbrellaSizeForZoom(zoom);
  const safeCrowd = normalizeCrowdLevel(crowdLevel);
  return `${size}|${selected ? "selected" : "normal"}|${favorite ? "favorite" : "normal"}|${state ?? "LIVE"}|${safeCrowd}`;
};

const getBeachPinAsset = (crowdLevel?: number) => {
  const safeCrowd = normalizeCrowdLevel(crowdLevel);
  switch (safeCrowd) {
    case 1:
      return beachPinEmpty;
    case 2:
      return beachPinLow;
    case 3:
      return beachPinCrowded;
    case 4:
    default:
      return beachPinFull;
  }
};

export const createBeachPinIcon = (options: BeachPinOptions) => {
  const key = getUmbrellaKey(options);
  const cached = beachPinCache.get(key);
  if (cached) return cached;

  const perfEnabled = isPerfEnabled();
  const start = perfEnabled ? performance.now() : 0;
  const isSelected = Boolean(options.selected);
  const isFavorite = Boolean(options.favorite);
  const isPred = options.state === "PRED";
  const baseSize = getUmbrellaSizeForZoom(options.zoom);
  const size = isSelected ? Math.round(baseSize * 1.08) : baseSize;
  const anchorX = Math.round(size * 0.5);
  const anchorY = Math.round(size * 0.8);
  const popupAnchorY = -Math.round(size * 0.65);
  const className = [
    "br-beach-pin",
    isSelected ? "br-beach-pin--selected" : "",
    isFavorite ? "br-beach-pin--favorite" : "",
    isPred ? "br-beach-pin--pred" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const icon = L.divIcon({
    className: "br-beach-pin-icon",
    html: `<div class="${className}" style="--pin-size:${size}px"><img class="br-beach-pin__img" src="${getBeachPinAsset(options.crowdLevel)}" alt="" loading="eager" decoding="async" />${isFavorite ? '<span class="br-beach-pin__favorite" aria-hidden="true">&#9733;</span>' : ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, popupAnchorY],
  });

  beachPinCache.set(key, icon);
  if (perfEnabled) {
    recordTiming("marker_icon_create", performance.now() - start, perfEnabled);
  }
  updateCacheSizeStat();
  return icon;
};

const getBubbleParams = (count: number) => {
  if (count >= 200) return { size: 36, bg: "#1e40af" };
  if (count >= 50) return { size: 30, bg: "#2563eb" };
  return { size: 24, bg: "#3b82f6" };
};

export const createClusterPinDivIcon = (count: number, zoom: number) => {
  const safeCount = Math.max(1, Math.round(count));
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;

  if (safeZoom <= 8) {
    const { size, bg } = getBubbleParams(safeCount);
    const label = safeCount >= 1000
      ? `${(safeCount / 1000).toFixed(safeCount >= 10000 ? 0 : 1)}k`
      : String(safeCount);
    const fontSize = Math.max(9, Math.round(size * (label.length >= 4 ? 0.28 : 0.34)));
    const key = `bubble|${size}|${safeCount}`;
    const cached = clusterPinCache.get(key);
    if (cached) return cached;

    const perfEnabled = isPerfEnabled();
    const start = perfEnabled ? performance.now() : 0;
    const icon = L.divIcon({
      className: "br-cluster-icon",
      html: `<div class="br-cluster-bubble" style="--s:${size}px;--bg:${bg};--fs:${fontSize}px">${label}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
    clusterPinCache.set(key, icon);
    if (perfEnabled) recordTiming("cluster_icon_create", performance.now() - start, perfEnabled);
    updateCacheSizeStat();
    return icon;
  }

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

  const perfEnabled = isPerfEnabled();
  const start = perfEnabled ? performance.now() : 0;
  const labelHitArea = Math.round(size * (digitCount >= 3 ? 1 : 0.8));
  const iconWidth = size + labelHitArea;
  const iconHeight = Math.round(size * 1.2);
  const anchorX = Math.round(size * 0.5);
  const anchorY = Math.round(size * 0.92);
  const popupAnchorY = -Math.round(size * 0.75);

  const icon = L.divIcon({
    className: "br-cluster-icon",
    html: `<div class="br-cluster" style="--s:${size}px"><img class="br-cluster__img" src="${clusterPin}" alt="" loading="eager" decoding="async" /><span class="br-cluster__label" style="--fs:${fontSize}px"><span class="br-cluster__x">x</span><span class="br-cluster__n">${safeCount}</span></span></div>`,
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, popupAnchorY],
  });

  clusterPinCache.set(key, icon);
  if (perfEnabled) {
    recordTiming("cluster_icon_create", performance.now() - start, perfEnabled);
  }
  updateCacheSizeStat();
  return icon;
};

export const getMarkerIconCacheSize = () =>
  beachPinCache.size + clusterPinCache.size;
