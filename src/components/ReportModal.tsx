import { useEffect, useMemo, useRef } from "react";
import type { CrowdLevel } from "../lib/types";
import type { LatLng } from "../lib/geo";
import { STRINGS } from "../i18n/it";

const RADIUS_M = 700;

const levelOptions: { level: CrowdLevel; label: string }[] = [
  { level: 1, label: STRINGS.crowdLevels[1] },
  { level: 2, label: STRINGS.crowdLevels[2] },
  { level: 3, label: STRINGS.crowdLevels[3] },
  { level: 4, label: STRINGS.crowdLevels[4] },
];

type ReportModalProps = {
  isOpen: boolean;
  beachName: string;
  userLocation: LatLng | null;
  distanceM: number | null;
  geoStatus: "idle" | "loading" | "ready" | "denied" | "error";
  geoError: string | null;
  onRequestLocation: () => void;
  onClose: () => void;
  onSubmit: (level: CrowdLevel) => void;
  submitError: string | null;
};

const ReportModal = ({
  isOpen,
  beachName,
  userLocation,
  distanceM,
  geoStatus,
  geoError,
  onRequestLocation,
  onClose,
  onSubmit,
  submitError,
}: ReportModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!userLocation && geoStatus === "idle") {
      onRequestLocation();
    }
  }, [geoStatus, isOpen, onRequestLocation, userLocation]);

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;
    const focusables = container.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusables[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const canReport = useMemo(() => {
    if (!userLocation || distanceM === null) return false;
    return distanceM <= RADIUS_M;
  }, [distanceM, userLocation]);

  if (!isOpen) return null;

  const locationMessage = () => {
    if (geoStatus === "loading") return STRINGS.report.locationSearching;
    if (geoStatus === "denied") return STRINGS.report.locationDenied;
    if (geoStatus === "error")
      return geoError ?? STRINGS.report.locationUnavailable;
    if (!userLocation) return STRINGS.report.locationRequired;
    if (distanceM !== null && distanceM > RADIUS_M) return STRINGS.report.tooFar;
    if (distanceM !== null) return STRINGS.report.nearEnough;
    return "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 pt-10">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.aria.reportBeach(beachName)}
        className="w-full max-w-screen-sm rounded-3xl border border-slate-800/80 bg-slate-950/95 px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">
              {STRINGS.report.title}
            </h3>
            <p className="text-sm text-slate-500">{beachName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={STRINGS.aria.closeReport}
            className="rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-400"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
          {locationMessage()}
        </div>

        {submitError ? (
          <div className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            {submitError}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {levelOptions.map((option) => (
            <button
              key={option.level}
              onClick={() => onSubmit(option.level)}
              disabled={!canReport}
              className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3 py-4 text-sm font-semibold text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {option.level} • {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
