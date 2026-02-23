import { useEffect, useMemo, useRef, useState } from "react";
import type { CrowdLevel, WaterLevel, BeachLevel } from "../lib/types";
import type { LatLng } from "../lib/geo";
import { STRINGS } from "../i18n/it";

const RADIUS_M = 700;

const levelOptions: { level: CrowdLevel; label: string }[] = [
  { level: 1, label: STRINGS.crowdLevels[1] },
  { level: 2, label: STRINGS.crowdLevels[2] },
  { level: 3, label: STRINGS.crowdLevels[3] },
  { level: 4, label: STRINGS.crowdLevels[4] },
];

const waterOptions: { level: WaterLevel; label: string }[] = [
  { level: 1, label: STRINGS.waterLevels[1] },
  { level: 2, label: STRINGS.waterLevels[2] },
  { level: 3, label: STRINGS.waterLevels[3] },
  { level: 4, label: STRINGS.waterLevels[4] },
];

const beachOptions: { level: BeachLevel; label: string }[] = [
  { level: 1, label: STRINGS.beachLevels[1] },
  { level: 2, label: STRINGS.beachLevels[2] },
  { level: 3, label: STRINGS.beachLevels[3] },
];

type ReportModalProps = {
  isOpen: boolean;
  beachName: string;
  userLocation: LatLng | null;
  distanceM: number | null;
  allowRemoteReports: boolean;
  geoStatus: "idle" | "loading" | "ready" | "denied" | "error";
  geoError: string | null;
  onRequestLocation: () => void;
  onClose: () => void;
  onSubmit: (level: CrowdLevel, water?: WaterLevel, beach?: BeachLevel) => void;
  submitError: string | null;
  submitting?: boolean;
};

const ReportModal = ({
  isOpen,
  beachName,
  userLocation,
  distanceM,
  allowRemoteReports,
  geoStatus,
  geoError,
  onRequestLocation,
  onClose,
  onSubmit,
  submitError,
  submitting = false,
}: ReportModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedCrowd, setSelectedCrowd] = useState<CrowdLevel | null>(null);
  const [selectedWater, setSelectedWater] = useState<WaterLevel | null>(null);
  const [selectedBeach, setSelectedBeach] = useState<BeachLevel | null>(null);

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
    if (allowRemoteReports) return true;
    if (!userLocation || distanceM === null) return false;
    return distanceM <= RADIUS_M;
  }, [allowRemoteReports, distanceM, userLocation]);

  if (!isOpen) return null;

  const locationMessage = () => {
    if (geoStatus === "loading") return STRINGS.report.locationSearching;
    if (
      allowRemoteReports &&
      (geoStatus === "denied" || geoStatus === "error" || !userLocation)
    ) {
      return STRINGS.report.remoteAllowed;
    }
    if (geoStatus === "denied") return STRINGS.report.locationDenied;
    if (geoStatus === "error")
      return geoError ?? STRINGS.report.locationUnavailable;
    if (!userLocation) return STRINGS.report.locationRequired;
    if (distanceM !== null && distanceM > RADIUS_M)
      return allowRemoteReports
        ? STRINGS.report.remoteAllowed
        : STRINGS.report.tooFar;
    if (distanceM !== null) return STRINGS.report.nearEnough;
    return "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 pt-10">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.aria.reportBeach(beachName)}
        data-testid="report-modal"
        className="w-full max-w-screen-sm rounded-[18px] contrast-guard px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold br-text-primary">
              {STRINGS.report.title}
            </h3>
            <p className="text-sm br-text-secondary">{beachName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={STRINGS.aria.closeReport}
            className="br-press rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="mt-4 rounded-[12px] border border-white/15 bg-black/30 px-4 py-3 text-xs br-text-secondary backdrop-blur-sm">
          {locationMessage()}
        </div>

        {submitError ? (
          <div
            data-testid="report-error"
            className="mt-3 rounded-[12px] border border-rose-300/60 bg-rose-500/25 px-4 py-2 text-xs text-rose-50"
          >
            {submitError}
          </div>
        ) : null}

        {submitting ? (
          <div className="mt-3 rounded-[12px] border border-sky-300/60 bg-sky-500/20 px-4 py-2 text-xs text-sky-50">
            {STRINGS.report.submitting}
          </div>
        ) : null}

        <div className="mt-5 space-y-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] br-text-tertiary mb-2 text-center">
              1. {STRINGS.labels.crowdStatus} *
            </div>
            <div className="grid grid-cols-2 gap-2">
              {levelOptions.map((option) => (
                <button
                  key={option.level}
                  onClick={() => setSelectedCrowd(option.level)}
                  disabled={!canReport || submitting}
                  className={`br-press rounded-[10px] border px-2 py-2.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${selectedCrowd === option.level
                      ? "border-sky-300/60 bg-sky-500/20 text-sky-100 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                      : "border-white/15 bg-black/40 br-text-secondary hover:border-white/25 hover:bg-black/50"
                    }`}
                >
                  <span className="opacity-50 text-[11px] mr-1.5">{option.level}</span> {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] br-text-tertiary mb-2 text-center md:text-left">
                2. {STRINGS.labels.waterStatus} <span className="text-[10px] lowercase font-normal opacity-60">(opzionale)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {waterOptions.map((option) => (
                  <button
                    key={option.level}
                    onClick={() => setSelectedWater(option.level === selectedWater ? null : option.level)}
                    disabled={!canReport || submitting}
                    className={`br-press rounded-[10px] border px-2 py-2 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${selectedWater === option.level
                        ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : "border-white/10 bg-black/30 br-text-tertiary hover:border-white/20 hover:bg-black/40"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] br-text-tertiary mb-2 text-center md:text-left">
                3. {STRINGS.labels.beachStatus} <span className="text-[10px] lowercase font-normal opacity-60">(opzionale)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {beachOptions.map((option) => (
                  <button
                    key={option.level}
                    onClick={() => setSelectedBeach(option.level === selectedBeach ? null : option.level)}
                    disabled={!canReport || submitting}
                    className={`br-press rounded-[10px] border px-2 py-2 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${selectedBeach === option.level
                        ? "border-amber-300/60 bg-amber-500/20 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : "border-white/10 bg-black/30 br-text-tertiary hover:border-white/20 hover:bg-black/40"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => selectedCrowd && onSubmit(selectedCrowd, selectedWater ?? undefined, selectedBeach ?? undefined)}
            disabled={!selectedCrowd || !canReport || submitting}
            className="br-press w-full rounded-[12px] border border-sky-300/60 bg-sky-500/30 px-4 py-3.5 text-[15px] font-semibold text-sky-50 shadow-[0_8px_20px_rgba(14,165,233,0.3)] backdrop-blur-sm transition hover:border-sky-300/80 hover:bg-sky-500/40 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30 disabled:shadow-none disabled:cursor-not-allowed mt-2"
          >
            {submitting ? STRINGS.report.submitting : "Invia segnalazione"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
