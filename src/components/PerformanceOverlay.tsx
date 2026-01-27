import { useEffect, useMemo, useState } from "react";
import {
  getPerfSnapshot,
  isPerfEnabled,
  subscribePerf,
} from "../lib/perf";

const formatMs = (value: number) => `${value.toFixed(1)}ms`;

const formatFps = (fps: number) => `${Math.round(fps)} fps`;

const PerformanceOverlay = () => {
  const enabled = isPerfEnabled();
  const [snapshot, setSnapshot] = useState(() => getPerfSnapshot());
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return subscribePerf((next) => setSnapshot(next));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let rafId = 0;
    let frameCount = 0;
    let lastMark = performance.now();

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastMark;
      if (elapsed >= 500) {
        const nextFps = (frameCount * 1000) / elapsed;
        setFps(nextFps);
        frameCount = 0;
        lastMark = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [enabled]);

  const rendersLine = useMemo(() => {
    const names = ["App", "MapView", "TopSearch", "BottomSheet", "LidoModalCard"];
    return names
      .map((name) => `${name}:${snapshot.renderCounts[name] ?? 0}`)
      .join(" · ");
  }, [snapshot.renderCounts]);

  if (!enabled) return null;

  const cluster = snapshot.cluster;
  const clusterLine = `cluster ${formatMs(cluster.lastMs)} (avg ${formatMs(cluster.avgMs)})`;

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+8px)] z-[1200] rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[10px] font-medium text-slate-100 shadow-lg backdrop-blur">
      <div className="text-slate-300">{formatFps(fps)}</div>
      <div className="mt-0.5 text-slate-400">{clusterLine}</div>
      <div className="mt-0.5 text-slate-400">
        icon cache {snapshot.markerIconCacheSize}
      </div>
      <div className="mt-1 text-slate-500">{rendersLine}</div>
    </div>
  );
};

export default PerformanceOverlay;
