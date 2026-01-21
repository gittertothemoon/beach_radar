import type { BeachWithStats } from "../lib/types";
import { crowdLabel, formatConfidence, formatMinutesAgo } from "../lib/format";

type BeachDrawerProps = {
  beach: BeachWithStats;
  now: number;
  onClose: () => void;
  onReport: () => void;
  onShare: () => void;
};

const stateClass = (state: string) => {
  switch (state) {
    case "LIVE":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/40";
    case "RECENT":
      return "bg-amber-400/15 text-amber-200 border-amber-300/40";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-400/40";
  }
};

const BeachDrawer = ({ beach, now, onClose, onReport, onShare }: BeachDrawerProps) => {
  const isPred = beach.state === "PRED";
  const reportCount = isPred ? 0 : beach.reportsCount;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 pb-4 pt-12">
      <div className="w-full max-w-screen-sm rounded-3xl border border-slate-800/80 bg-slate-950/95 px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stateClass(
                  beach.state,
                )}`}
              >
                {beach.state}
              </span>
              {isPred ? (
                <span className="text-xs text-slate-400">Stima (baseline)</span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-100">
              {beach.name}
            </h2>
            <p className="text-sm text-slate-500">{beach.region}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi dettagli spiaggia"
            className="rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-400"
          >
            Chiudi
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Crowd</span>
            <span className="font-semibold">{crowdLabel(beach.crowdLevel)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Confidence</span>
            <span className="font-semibold">{formatConfidence(beach.confidence)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Aggiornamento</span>
            <span className="font-semibold">
              {formatMinutesAgo(beach.updatedAt, now)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Report</span>
            <span className="font-semibold">{reportCount}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onReport}
            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950"
          >
            Segnala
          </button>
          <button
            onClick={onShare}
            className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100"
          >
            Condividi
          </button>
        </div>
      </div>
    </div>
  );
};

export default BeachDrawer;
