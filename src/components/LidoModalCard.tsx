import { useEffect, useRef } from "react";
import type { BeachWithStats } from "../lib/types";
import { STRINGS } from "../i18n/it";
import {
  crowdLevelLabel,
  formatConfidence,
  formatMinutesAgo,
  formatStateLabel,
} from "../lib/format";

type LidoModalCardProps = {
  beach: BeachWithStats;
  isOpen: boolean;
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

const LidoModalCard = ({
  beach,
  isOpen,
  now,
  onClose,
  onReport,
  onShare,
}: LidoModalCardProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isPred = beach.state === "PRED";

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusables || focusables.length === 0) return;

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

  if (!isOpen) return null;

  const address = beach.address?.trim();
  const hours = beach.hours?.trim();
  const phone = beach.phone?.trim();
  const website = beach.website?.trim();
  const services = beach.services?.filter(Boolean);
  const hasCoords = Number.isFinite(beach.lat) && Number.isFinite(beach.lng);
  const mapsLink = hasCoords
    ? `https://www.google.com/maps?q=${beach.lat},${beach.lng}`
    : null;
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-[calc(env(safe-area-inset-top)+16px)]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.aria.beachDetails(beach.name)}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80svh] w-[min(92vw,560px)] flex-col overflow-hidden rounded-[20px] br-surface-strong"
      >
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${stateClass(
                  beach.state,
                )}`}
              >
                {formatStateLabel(beach.state)}
              </span>
              {isPred ? (
                <span className="text-[11px] text-slate-400">
                  {STRINGS.status.predLong}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.01em] text-slate-100">
              {beach.name}
            </h2>
            <p className="text-[13px] text-slate-500">{beach.region}</p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={STRINGS.aria.closeBeachDetails}
            className="br-press rounded-full border border-white/10 bg-slate-900/50 px-3 py-1.5 text-[11px] font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4">
          <div className="rounded-[16px] br-surface-soft p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-400">
              <span>{STRINGS.labels.crowdStatus}</span>
              <span className="text-[11px] font-semibold text-slate-300">
                {crowdLevelLabel(beach.crowdLevel)}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  {STRINGS.labels.confidence}
                </span>
                <span className="font-semibold">
                  {formatConfidence(beach.confidence)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  {STRINGS.labels.lastUpdate}
                </span>
                <span className="font-semibold">
                  {formatMinutesAgo(beach.updatedAt, now)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[16px] br-surface-soft p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
              {STRINGS.labels.address}
            </div>
            <p className="mt-2 text-[13px] text-slate-100">
              {address || STRINGS.empty.notAvailable}
            </p>
            {mapsLink ? (
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-[12px] font-semibold text-sky-300"
              >
                {STRINGS.actions.openInMaps}
              </a>
            ) : null}
          </div>

          <div className="rounded-[16px] br-surface-soft p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
              {STRINGS.labels.hours}
            </div>
            <p className="mt-2 text-[13px] text-slate-100">
              {hours || STRINGS.empty.toConfirm}
            </p>
          </div>

          <div className="rounded-[16px] br-surface-soft p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
              {STRINGS.labels.usefulInfo}
            </div>
            <div className="mt-3 grid gap-2 text-[13px] text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{STRINGS.labels.phone}</span>
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="font-semibold text-slate-100"
                  >
                    {phone}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-500">
                    {STRINGS.empty.notAvailable}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{STRINGS.labels.website}</span>
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-100"
                  >
                    {website}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-500">
                    {STRINGS.empty.notAvailable}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3">
              {services && services.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <span
                      key={service}
                      className="rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-slate-200"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-500">
                  {STRINGS.empty.notAvailable}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="br-hairline border-t bg-slate-950/60 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onReport}
              className="br-press rounded-[12px] bg-emerald-400 px-4 py-3 text-[14px] font-semibold text-emerald-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-200/50"
            >
              {STRINGS.actions.report}
            </button>
            <button
              onClick={onShare}
              className="br-press rounded-[12px] border border-white/10 bg-slate-900/50 px-4 py-3 text-[14px] font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
            >
              {STRINGS.actions.share}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LidoModalCard;
