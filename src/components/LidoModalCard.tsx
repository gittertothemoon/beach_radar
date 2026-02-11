import { memo, useEffect, useRef } from "react";
import type { BeachWithStats } from "../lib/types";
import { STRINGS } from "../i18n/it";
import {
  crowdLevelLabel,
  formatConfidence,
  formatMinutesAgo,
  formatStateLabel,
} from "../lib/format";
import { formatWeatherHour, type BeachWeatherSnapshot } from "../lib/weather";
import { isPerfEnabled, useRenderCounter } from "../lib/perf";

type LidoModalCardProps = {
  beach: BeachWithStats;
  isOpen: boolean;
  now: number;
  isFavorite: boolean;
  weather: BeachWeatherSnapshot | null;
  weatherLoading: boolean;
  weatherUnavailable: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onReport: () => void;
  onShare: () => void;
};

const stateClass = (state: string) => {
  switch (state) {
    case "LIVE":
      return "bg-emerald-500/30 text-emerald-100 border-emerald-300/60";
    case "RECENT":
      return "bg-amber-400/30 text-amber-100 border-amber-300/60";
    default:
      return "bg-slate-400/25 text-slate-100 border-slate-300/50";
  }
};

const sameServices = (a?: string[], b?: string[]) => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const formatRainProbability = (value: number | null) =>
  value === null ? STRINGS.weather.noRainData : `${Math.round(value)}%`;

const sameNextHours = (
  a: BeachWeatherSnapshot["nextHours"],
  b: BeachWeatherSnapshot["nextHours"],
) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].ts !== b[i].ts ||
      a[i].temperatureC !== b[i].temperatureC ||
      a[i].rainProbability !== b[i].rainProbability ||
      a[i].weatherCode !== b[i].weatherCode ||
      a[i].conditionLabel !== b[i].conditionLabel
    ) {
      return false;
    }
  }
  return true;
};

const sameWeather = (
  a: BeachWeatherSnapshot | null,
  b: BeachWeatherSnapshot | null,
) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fetchedAt === b.fetchedAt &&
    a.expiresAt === b.expiresAt &&
    a.timezone === b.timezone &&
    a.current.ts === b.current.ts &&
    a.current.temperatureC === b.current.temperatureC &&
    a.current.windKmh === b.current.windKmh &&
    a.current.rainProbability === b.current.rainProbability &&
    a.current.weatherCode === b.current.weatherCode &&
    a.current.isDay === b.current.isDay &&
    a.current.conditionLabel === b.current.conditionLabel &&
    sameNextHours(a.nextHours, b.nextHours)
  );
};

const LidoModalCardComponent = ({
  beach,
  isOpen,
  now,
  isFavorite,
  weather,
  weatherLoading,
  weatherUnavailable,
  onClose,
  onToggleFavorite,
  onReport,
  onShare,
}: LidoModalCardProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("LidoModalCard", perfEnabled);
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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-[calc(env(safe-area-inset-top)+16px)]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.aria.beachDetails(beach.name)}
        data-testid="lido-modal"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80svh] w-[min(92vw,560px)] flex-col overflow-hidden rounded-[18px] contrast-guard"
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
                <span className="text-[11px] br-text-tertiary">
                  {STRINGS.status.predLong}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 flex items-start gap-2 text-[22px] font-semibold tracking-[-0.01em] br-text-primary">
              <span className="min-w-0 flex-1 break-words">{beach.name}</span>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={STRINGS.aria.toggleFavoriteBeach(beach.name, isFavorite)}
                data-testid="favorite-toggle"
                className={`br-press inline-flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
                  isFavorite
                    ? "border-amber-300/55 bg-amber-400/20 text-amber-100"
                    : "border-white/18 bg-black/40 br-text-tertiary"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 2.7l2.8 5.67 6.25.91-4.53 4.42 1.07 6.24L12 17.06 6.4 19.94l1.07-6.24-4.53-4.42 6.25-.91L12 2.7z" />
                </svg>
              </button>
            </h2>
            <p className="text-[13px] br-text-secondary">{beach.region}</p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={STRINGS.aria.closeBeachDetails}
            className="br-press rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4">
          <div className="rounded-[12px] border border-white/15 bg-black/30 p-4 text-sm br-text-primary backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
              <span>{STRINGS.labels.crowdStatus}</span>
              <span className="text-[11px] font-semibold br-text-primary">
                {crowdLevelLabel(beach.crowdLevel)}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between">
                <span className="br-text-tertiary">
                  {STRINGS.labels.confidence}
                </span>
                <span className="font-semibold">
                  {formatConfidence(beach.confidence)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="br-text-tertiary">
                  {STRINGS.labels.lastUpdate}
                </span>
                <span className="font-semibold">
                  {formatMinutesAgo(beach.updatedAt, now)}
                </span>
              </div>
            </div>
          </div>

          <div
            data-testid="lido-weather"
            className="rounded-[12px] border border-white/15 bg-black/30 p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
              <span>{STRINGS.labels.weather}</span>
              {weather ? (
                <span className="font-semibold br-text-primary">
                  {STRINGS.weather.updated}{" "}
                  {formatWeatherHour(weather.current.ts, weather.timezone)}
                </span>
              ) : null}
            </div>
            {weather ? (
              <div className="mt-3 grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] br-text-primary">
                    {weather.current.conditionLabel}
                  </div>
                  <div className="text-[18px] font-semibold br-text-primary">
                    {Math.round(weather.current.temperatureC)}°C
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="br-text-tertiary">{STRINGS.weather.wind}</span>
                  <span className="font-semibold br-text-primary">
                    {Math.round(weather.current.windKmh)} km/h
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="br-text-tertiary">
                    {STRINGS.weather.rainProbability}
                  </span>
                  <span className="font-semibold br-text-primary">
                    {formatRainProbability(weather.current.rainProbability)}
                  </span>
                </div>
                {weather.nextHours.length > 0 ? (
                  <div className="mt-1">
                    <div className="text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
                      {STRINGS.weather.nextHours}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {weather.nextHours.map((hour) => (
                        <div
                          key={hour.ts}
                          className="rounded-lg border border-white/10 bg-black/20 px-2 py-2"
                        >
                          <div className="flex items-center justify-between text-[11px] br-text-primary">
                            <span>{formatWeatherHour(hour.ts, weather.timezone)}</span>
                            <span>{Math.round(hour.temperatureC)}°C</span>
                          </div>
                          <div className="mt-1 text-[10px] br-text-secondary">
                            {hour.conditionLabel}
                          </div>
                          <div className="mt-1 text-[10px] br-text-tertiary">
                            {STRINGS.weather.rainProbability}:{" "}
                            {formatRainProbability(hour.rainProbability)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : weatherLoading ? (
              <p className="mt-3 text-[13px] br-text-secondary">
                {STRINGS.weather.loading}
              </p>
            ) : weatherUnavailable ? (
              <p className="mt-3 text-[13px] br-text-tertiary">
                {STRINGS.weather.unavailable}
              </p>
            ) : (
              <p className="mt-3 text-[13px] br-text-secondary">
                {STRINGS.weather.loading}
              </p>
            )}
          </div>

          <div className="rounded-[12px] border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
              {STRINGS.labels.address}
            </div>
            <p className="mt-2 text-[13px] br-text-primary">
              {address || STRINGS.empty.notAvailable}
            </p>
            {mapsLink ? (
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-[12px] font-semibold br-text-primary"
              >
                {STRINGS.actions.openInMaps}
              </a>
            ) : null}
          </div>

          <div className="rounded-[12px] border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
              {STRINGS.labels.hours}
            </div>
            <p className="mt-2 text-[13px] br-text-primary">
              {hours || STRINGS.empty.toConfirm}
            </p>
          </div>

          <div className="rounded-[12px] border border-white/15 bg-black/30 p-4 backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.12em] br-text-tertiary">
              {STRINGS.labels.usefulInfo}
            </div>
            <div className="mt-3 grid gap-2 text-[13px] br-text-primary">
              <div className="flex items-center justify-between">
                <span className="br-text-tertiary">{STRINGS.labels.phone}</span>
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="font-semibold br-text-primary"
                  >
                    {phone}
                  </a>
                ) : (
                  <span className="font-semibold br-text-tertiary">
                    {STRINGS.empty.notAvailable}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="br-text-tertiary">{STRINGS.labels.website}</span>
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold br-text-primary"
                  >
                    {website}
                  </a>
                ) : (
                  <span className="font-semibold br-text-tertiary">
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
                      className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-semibold br-text-primary"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] br-text-tertiary">
                  {STRINGS.empty.notAvailable}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="br-hairline border-t bg-black/40 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onReport}
              data-testid="report-cta"
              className="br-press rounded-[12px] border border-white/25 bg-black/50 px-4 py-3 text-[14px] font-semibold text-slate-50 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
            >
              {STRINGS.actions.report}
            </button>
            <button
              onClick={onShare}
              className="br-press rounded-[12px] border border-white/18 bg-black/40 px-4 py-3 text-[14px] font-semibold br-text-primary backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
            >
              {STRINGS.actions.share}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const lidoModalEqual = (prev: LidoModalCardProps, next: LidoModalCardProps) => {
  if (prev.isOpen !== next.isOpen) return false;
  if (prev.now !== next.now) return false;
  if (prev.isFavorite !== next.isFavorite) return false;
  if (prev.weatherLoading !== next.weatherLoading) return false;
  if (prev.weatherUnavailable !== next.weatherUnavailable) return false;
  if (!sameWeather(prev.weather, next.weather)) return false;
  if (prev.onClose !== next.onClose) return false;
  if (prev.onToggleFavorite !== next.onToggleFavorite) return false;
  if (prev.onReport !== next.onReport) return false;
  if (prev.onShare !== next.onShare) return false;
  const a = prev.beach;
  const b = next.beach;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.region === b.region &&
    a.state === b.state &&
    a.crowdLevel === b.crowdLevel &&
    a.confidence === b.confidence &&
    a.updatedAt === b.updatedAt &&
    a.reportsCount === b.reportsCount &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.address === b.address &&
    a.hours === b.hours &&
    a.phone === b.phone &&
    a.website === b.website &&
    sameServices(a.services, b.services)
  );
};

const LidoModalCard = memo(LidoModalCardComponent, lidoModalEqual);

export default LidoModalCard;
