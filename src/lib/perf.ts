/* Dev-only performance instrumentation for Where2Beach. */

type RenderCounts = Record<string, number>;

type TimingEntry = {
  lastMs: number;
  maxMs: number;
  avgMs: number;
  samples: number;
};

type ClusterStats = {
  lastMs: number;
  maxMs: number;
  avgMs: number;
  samples: number;
  lastZoom: number | null;
  lastClusterCount: number;
  lastSingleCount: number;
};

type PerfSnapshot = {
  enabled: boolean;
  renderCounts: RenderCounts;
  timings: Record<string, TimingEntry>;
  cluster: ClusterStats;
  markerIconCacheSize: number;
};

type PerfListener = (snapshot: PerfSnapshot) => void;

const LOG_THRESHOLDS_MS: Record<string, number> = {
  clustering: 12,
  marker_icon_create: 6,
  cluster_icon_create: 6,
  share_card_render: 24,
};

const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const DEV_ENABLED = import.meta.env.DEV;

export const isPerfEnabled = () => {
  if (!DEV_ENABLED) return false;
  if (typeof window === "undefined") return false;
  try {
    return (
      window.location.pathname.startsWith("/debug") ||
      window.localStorage.getItem("br_debug_v1") === "1"
    );
  } catch {
    return false;
  }
};

const state: PerfSnapshot = {
  enabled: false,
  renderCounts: {},
  timings: {},
  cluster: {
    lastMs: 0,
    maxMs: 0,
    avgMs: 0,
    samples: 0,
    lastZoom: null,
    lastClusterCount: 0,
    lastSingleCount: 0,
  },
  markerIconCacheSize: 0,
};

const listeners = new Set<PerfListener>();
let notifyScheduled = false;

const scheduleNotify = () => {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const run = () => {
    notifyScheduled = false;
    const snapshot = getPerfSnapshot();
    listeners.forEach((listener) => listener(snapshot));
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(run);
    return;
  }
  window.setTimeout(run, 0);
};

const updateEnabledFlag = () => {
  state.enabled = isPerfEnabled();
};

const updateTimingEntry = (name: string, ms: number) => {
  const entry = state.timings[name];
  if (!entry) {
    state.timings[name] = {
      lastMs: ms,
      maxMs: ms,
      avgMs: ms,
      samples: 1,
    };
    return;
  }
  const samples = entry.samples + 1;
  entry.lastMs = ms;
  entry.maxMs = Math.max(entry.maxMs, ms);
  entry.avgMs = entry.avgMs + (ms - entry.avgMs) / samples;
  entry.samples = samples;
};

const maybeLogTiming = (name: string, ms: number) => {
  if (!state.enabled) return;
  const threshold = LOG_THRESHOLDS_MS[name];
  if (!threshold || ms < threshold) return;
  console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`);
};

export const recordRender = (name: string, enabledOverride?: boolean) => {
  if (!DEV_ENABLED) return;
  updateEnabledFlag();
  const enabled = enabledOverride ?? state.enabled;
  if (!enabled) return;
  state.renderCounts[name] = (state.renderCounts[name] ?? 0) + 1;
  scheduleNotify();
};

export const recordTiming = (name: string, ms: number, enabledOverride?: boolean) => {
  if (!DEV_ENABLED) return;
  updateEnabledFlag();
  const enabled = enabledOverride ?? state.enabled;
  if (!enabled) return;
  updateTimingEntry(name, ms);
  maybeLogTiming(name, ms);
  scheduleNotify();
};

export const timeSync = <T,>(
  name: string,
  fn: () => T,
  enabledOverride?: boolean,
) => {
  const enabled = enabledOverride ?? isPerfEnabled();
  if (!enabled) return fn();
  const start = getNow();
  const result = fn();
  const end = getNow();
  recordTiming(name, end - start, enabled);
  return result;
};

export const recordClusterStats = (details: {
  durationMs: number;
  zoom: number;
  clusterCount: number;
  singleCount: number;
}) => {
  if (!DEV_ENABLED) return;
  updateEnabledFlag();
  if (!state.enabled) return;
  const { durationMs, zoom, clusterCount, singleCount } = details;
  const nextSamples = state.cluster.samples + 1;
  state.cluster.lastMs = durationMs;
  state.cluster.maxMs = Math.max(state.cluster.maxMs, durationMs);
  state.cluster.avgMs =
    state.cluster.avgMs + (durationMs - state.cluster.avgMs) / nextSamples;
  state.cluster.samples = nextSamples;
  state.cluster.lastZoom = zoom;
  state.cluster.lastClusterCount = clusterCount;
  state.cluster.lastSingleCount = singleCount;
  maybeLogTiming("clustering", durationMs);
  scheduleNotify();
};

export const setMarkerIconCacheSize = (size: number) => {
  if (!DEV_ENABLED) return;
  updateEnabledFlag();
  if (!state.enabled) return;
  state.markerIconCacheSize = size;
  scheduleNotify();
};

export const clearPerfStats = () => {
  if (!DEV_ENABLED) return;
  state.renderCounts = {};
  state.timings = {};
  state.cluster = {
    lastMs: 0,
    maxMs: 0,
    avgMs: 0,
    samples: 0,
    lastZoom: null,
    lastClusterCount: 0,
    lastSingleCount: 0,
  };
  state.markerIconCacheSize = 0;
  scheduleNotify();
};

export const subscribePerf = (listener: PerfListener) => {
  if (!DEV_ENABLED) {
    listener(getPerfSnapshot());
    return () => {};
  }
  listeners.add(listener);
  listener(getPerfSnapshot());
  return () => {
    listeners.delete(listener);
  };
};

export const getPerfSnapshot = (): PerfSnapshot => {
  updateEnabledFlag();
  return {
    enabled: state.enabled,
    renderCounts: { ...state.renderCounts },
    timings: { ...state.timings },
    cluster: { ...state.cluster },
    markerIconCacheSize: state.markerIconCacheSize,
  };
};

export const useRenderCounter = (name: string, enabled: boolean) => {
  recordRender(name, enabled);
};
