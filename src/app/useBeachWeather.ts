import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchBeachWeather,
  type BeachWeatherSnapshot,
} from "../lib/weather";
import { weatherCacheKey } from "./appState";

type WeatherCacheEntry = {
  status: "loading" | "ready" | "error";
  data: BeachWeatherSnapshot | null;
  expiresAt: number;
};

type UseBeachWeatherInput = {
  selectedBeachLat: number | null;
  selectedBeachLng: number | null;
};

type UseBeachWeatherOutput = {
  selectedWeather: BeachWeatherSnapshot | null;
  selectedWeatherLoading: boolean;
  selectedWeatherUnavailable: boolean;
};

export const useBeachWeather = ({
  selectedBeachLat,
  selectedBeachLng,
}: UseBeachWeatherInput): UseBeachWeatherOutput => {
  const [weatherByKey, setWeatherByKey] = useState<
    Record<string, WeatherCacheEntry>
  >({});
  const weatherByKeyRef = useRef<Record<string, WeatherCacheEntry>>({});
  const [retryKey, setRetryKey] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    weatherByKeyRef.current = weatherByKey;
  }, [weatherByKey]);

  const selectedWeatherKey = useMemo(() => {
    if (
      selectedBeachLat === null ||
      selectedBeachLng === null ||
      !Number.isFinite(selectedBeachLat) ||
      !Number.isFinite(selectedBeachLng)
    ) {
      return null;
    }
    return weatherCacheKey(selectedBeachLat, selectedBeachLng);
  }, [selectedBeachLat, selectedBeachLng]);

  const selectedWeatherEntry = selectedWeatherKey
    ? weatherByKey[selectedWeatherKey]
    : undefined;
  const selectedWeather = selectedWeatherEntry?.data ?? null;
  const selectedWeatherLoading =
    selectedWeatherEntry?.status === "loading" &&
    selectedWeatherEntry.data === null;
  const selectedWeatherUnavailable =
    selectedWeatherEntry?.status === "error" &&
    selectedWeatherEntry.data === null;

  useEffect(() => {
    if (!selectedWeatherKey) return;
    if (
      selectedBeachLat === null ||
      selectedBeachLng === null ||
      !Number.isFinite(selectedBeachLat) ||
      !Number.isFinite(selectedBeachLng)
    ) {
      return;
    }

    const nowTs = Date.now();
    const currentEntry = weatherByKeyRef.current[selectedWeatherKey];
    if (currentEntry?.status === "loading") return;
    if (
      currentEntry?.status === "ready" &&
      currentEntry.expiresAt > nowTs
    ) {
      return;
    }

    const controller = new AbortController();

    // Cache entry must be marked loading synchronously to prevent a second
    // render from re-entering the effect and kicking off a duplicate fetch
    // before the "loading" flag is visible. Deferring this (microtask/layout)
    // reintroduces the race observed when the hook was cache-miss prone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeatherByKey((prev) => {
      const current = prev[selectedWeatherKey];
      return {
        ...prev,
        [selectedWeatherKey]: {
          status: "loading",
          data: current?.data ?? null,
          expiresAt: current?.expiresAt ?? 0,
        },
      };
    });

    void fetchBeachWeather(selectedBeachLat, selectedBeachLng, controller.signal)
      .then((snapshot) => {
        setWeatherByKey((prev) => ({
          ...prev,
          [selectedWeatherKey]: {
            status: "ready",
            data: snapshot,
            expiresAt: snapshot.expiresAt,
          },
        }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setWeatherByKey((prev) => {
          const current = prev[selectedWeatherKey];
          return {
            ...prev,
            [selectedWeatherKey]: {
              status: "error",
              data: current?.data ?? null,
              expiresAt: current?.expiresAt ?? 0,
            },
          };
        });
        retryTimeoutRef.current = setTimeout(() => {
          setRetryKey((k) => k + 1);
        }, 10_000);
      });

    return () => {
      controller.abort();
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [selectedBeachLat, selectedBeachLng, selectedWeatherKey, retryKey]);

  return {
    selectedWeather,
    selectedWeatherLoading,
    selectedWeatherUnavailable,
  };
};
