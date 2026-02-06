import { memo } from "react";
import { STRINGS } from "../i18n/it";
import type { BeachWeatherSnapshot } from "../lib/weather";

type WeatherWidgetProps = {
  beachName: string;
  weather: BeachWeatherSnapshot | null;
  weatherLoading: boolean;
  weatherUnavailable: boolean;
  onOpenDetails: () => void;
};

const formatRainProbability = (value: number | null) =>
  value === null ? STRINGS.weather.noRainData : `${Math.round(value)}%`;

const WeatherWidgetComponent = ({
  beachName,
  weather,
  weatherLoading,
  weatherUnavailable,
  onOpenDetails,
}: WeatherWidgetProps) => {
  return (
    <button
      type="button"
      onClick={onOpenDetails}
      aria-label={`${STRINGS.labels.weather} ${beachName}`}
      className="br-press fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+126px)] z-40 w-[min(68vw,240px)] rounded-2xl border border-white/16 bg-black/40 px-3 py-2 text-left text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:border-white/28 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 sm:bottom-[calc(env(safe-area-inset-bottom)+168px)]"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em] br-text-tertiary">
        <span>{STRINGS.labels.weather}</span>
        <span className="max-w-[120px] truncate br-text-secondary">{beachName}</span>
      </div>
      {weather ? (
        <div className="mt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium br-text-primary">
              {weather.current.conditionLabel}
            </span>
            <span className="text-[19px] font-semibold br-text-primary">
              {Math.round(weather.current.temperatureC)}°
            </span>
          </div>
          <div className="mt-1 text-[10px] br-text-tertiary">
            {STRINGS.weather.rainProbability}:{" "}
            {formatRainProbability(weather.current.rainProbability)} ·{" "}
            {STRINGS.weather.wind}: {Math.round(weather.current.windKmh)} km/h
          </div>
        </div>
      ) : weatherLoading ? (
        <div className="mt-1 text-[12px] br-text-secondary">
          {STRINGS.weather.loading}
        </div>
      ) : weatherUnavailable ? (
        <div className="mt-1 text-[12px] br-text-secondary">
          {STRINGS.weather.unavailable}
        </div>
      ) : (
        <div className="mt-1 text-[12px] br-text-secondary">
          {STRINGS.weather.loading}
        </div>
      )}
    </button>
  );
};

const weatherWidgetEqual = (prev: WeatherWidgetProps, next: WeatherWidgetProps) =>
  prev.beachName === next.beachName &&
  prev.weather === next.weather &&
  prev.weatherLoading === next.weatherLoading &&
  prev.weatherUnavailable === next.weatherUnavailable &&
  prev.onOpenDetails === next.onOpenDetails;

const WeatherWidget = memo(WeatherWidgetComponent, weatherWidgetEqual);

export default WeatherWidget;
