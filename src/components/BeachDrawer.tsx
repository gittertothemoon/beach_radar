import type { BeachWithStats } from "../lib/types";
import { STRINGS } from "../i18n/it";
import {
  crowdLabel,
  formatConfidence,
  formatMinutesAgo,
  formatStateLabel,
} from "../lib/format";

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

const BeachDrawer = ({
  beach,
  now,
  onClose,
  onReport,
  onShare,
}: BeachDrawerProps) => {
  const isPred = beach.state === "PRED";
  const reportCount = isPred ? 0 : beach.reportsCount;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 px-4 pb-4 pt-12">
      <div className="w-full max-w-screen-sm rounded-3xl border border-white/10 bg-black/50 px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stateClass(
                  beach.state,
                )}`}
              >
                {formatStateLabel(beach.state)}
              </span>
              {isPred ? (
                <span className="text-xs text-slate-400">
                  {STRINGS.status.predLong}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-100">
              {beach.name}
            </h2>
            <p className="text-sm text-slate-500">{beach.region}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={STRINGS.aria.closeBeachDetails}
            className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/12 bg-black/30 p-4 text-sm text-slate-200 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{STRINGS.labels.crowd}</span>
            <span className="font-semibold">{crowdLabel(beach.crowdLevel)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{STRINGS.labels.confidence}</span>
            <span className="font-semibold">
              {formatConfidence(beach.confidence)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{STRINGS.labels.update}</span>
            <span className="font-semibold">
              {formatMinutesAgo(beach.updatedAt, now)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{STRINGS.labels.reports}</span>
            <span className="font-semibold">
              {reportCount === 0
                ? STRINGS.reports.noneRecent
                : reportCount.toString()}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onReport}
            className="br-press rounded-2xl border border-white/25 bg-black/50 px-4 py-3 text-sm font-semibold text-slate-50 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          >
            {STRINGS.actions.report}
          </button>
          <button
            onClick={onShare}
            className="br-press rounded-2xl border border-white/18 bg-black/40 px-4 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm"
          >
            {STRINGS.actions.share}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BeachDrawer;
