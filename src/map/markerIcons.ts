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

const getUmbrellaSizeForZoom = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 11) return 22;
  if (z <= 13) return 26;
  if (z <= 15) return 30;
  if (z === 16) return 34;
  return 38;
};

const getClusterZoomFactor = (zoom: number) => {
  const z = getRoundedZoom(zoom);
  if (z <= 8) return 0.75;
  if (z <= 11) return 0.9;
  if (z <= 14) return 1.0;
  return 1.05;
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
  const anchorX = Math.round(size * 0.41);
  const anchorY = Math.round(size * 0.86);
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
    className,
  });

  beachPinCache.set(key, icon);
  return icon;
};

export const createClusterPinDivIcon = (count: number, zoom: number) => {
  const safeCount = Math.max(1, Math.round(count));
  const countText = `\u00d7${safeCount}`;
  const digitCount = String(safeCount).length;
  const base = 34 + 8 * Math.log10(safeCount + 1);
  const scaledBase = clamp(34, 56, base);
  const size = Math.round(scaledBase * getClusterZoomFactor(zoom));
  const digitScale = digitCount === 1 ? 1 : digitCount === 2 ? 0.9 : 0.78;
  const safeTop = Math.round(size * 0.12);
  const safeLeft = Math.round(size * 0.18);
  const safeBottom = Math.round(size * 0.26);
  const fontBase = Math.round(size * 0.34);
  const key = `${size}|${countText}|${digitScale}`;
  const cached = clusterPinCache.get(key);
  if (cached) return cached;

  const anchorX = Math.round(size * 0.5);
  const anchorY = Math.round(size * 0.96);

  const icon = L.divIcon({
    className: "",
    html: `<div class="br-cluster" style="--s:${size}px;--safe-top:${safeTop}px;--safe-left:${safeLeft}px;--safe-bottom:${safeBottom}px;--digit-scale:${digitScale};--fs-base:${fontBase}px"><img class="br-cluster__img" src="${clusterPin}" alt="" loading="eager" decoding="async" /><div class="br-cluster__safe"><div class="br-cluster__count">${countText}</div></div></div>`,
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
  });

  clusterPinCache.set(key, icon);
  return icon;
};
