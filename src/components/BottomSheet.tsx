import type { BeachWithStats } from "../lib/types";
import { formatConfidence, formatDistance, formatMinutesAgo } from "../lib/format";

type BottomSheetProps = {
  beaches: BeachWithStats[];
  selectedBeachId: string | null;
  onSelectBeach: (beachId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  now: number;
};

const stateBadge = (state: string) => {
  switch (state) {
    case "LIVE":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/40";
    case "RECENT":
      return "bg-amber-400/15 text-amber-200 border-amber-300/40";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-400/40";
  }
};

const BottomSheet = ({
  beaches,
  selectedBeachId,
  onSelectBeach,
  isOpen,
  onToggle,
  now,
}: BottomSheetProps) => (
  <div
    className={`fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ${
      isOpen
        ? "translate-y-0"
        : "translate-y-[calc(100%-90px)]"
    }`}
  >
    <div className="mx-auto max-w-screen-sm rounded-t-3xl border border-slate-800/80 bg-slate-950/95 shadow-2xl">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label="Espandi elenco spiagge"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">
            Spiagge vicine
          </div>
          <div className="text-xs text-slate-500">
            {beaches.length} risultati
          </div>
        </div>
        <div className="h-1.5 w-10 rounded-full bg-slate-700" />
      </button>
      <div className="max-h-[62vh] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="space-y-3 pb-6">
          {beaches.map((beach) => (
            <button
              key={beach.id}
              onClick={() => onSelectBeach(beach.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                beach.id === selectedBeachId
                  ? "border-sky-400/60 bg-slate-900/80"
                  : "border-slate-800/70 bg-slate-900/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadge(
                    beach.state,
                  )}`}
                >
                  {beach.state}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDistance(beach.distanceM)}
                </span>
              </div>
              <div className="mt-2 text-base font-semibold text-slate-100">
                {beach.name}
              </div>
              <div className="text-xs text-slate-500">{beach.region}</div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{formatConfidence(beach.confidence)}</span>
                <span>{formatMinutesAgo(beach.updatedAt, now)}</span>
                <span>{beach.reportsCount} report</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default BottomSheet;
