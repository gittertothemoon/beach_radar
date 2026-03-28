import { useEffect, useMemo, useRef, useState } from "react";
import { fetchBeachProfile } from "../lib/beachProfiles";
import type { BeachProfile } from "../lib/types";

type BeachProfileCacheEntry = {
  status: "idle" | "loading" | "ready" | "error";
  data: BeachProfile | null;
  fetchedAt: number;
};

type UseBeachProfilesInput = {
  selectedBeachId: string | null;
  isLidoModalOpen: boolean;
  cacheTtlMs: number;
};

type UseBeachProfilesOutput = {
  selectedBeachProfile: BeachProfile | null;
  selectedBeachProfileLoading: boolean;
};

export const useBeachProfiles = ({
  selectedBeachId,
  isLidoModalOpen,
  cacheTtlMs,
}: UseBeachProfilesInput): UseBeachProfilesOutput => {
  const [beachProfilesById, setBeachProfilesById] = useState<
    Record<string, BeachProfileCacheEntry>
  >({});
  const beachProfilesByIdRef = useRef<Record<string, BeachProfileCacheEntry>>({});

  useEffect(() => {
    beachProfilesByIdRef.current = beachProfilesById;
  }, [beachProfilesById]);

  useEffect(() => {
    if (!selectedBeachId || !isLidoModalOpen) return;

    let active = true;
    const cached = beachProfilesByIdRef.current[selectedBeachId];
    if (cached?.status === "loading") {
      return () => {
        active = false;
      };
    }
    if (
      cached?.status === "error" &&
      Date.now() - cached.fetchedAt < 60_000
    ) {
      return () => {
        active = false;
      };
    }
    const isFresh =
      cached?.status === "ready" &&
      Date.now() - cached.fetchedAt < cacheTtlMs;

    if (isFresh) {
      return () => {
        active = false;
      };
    }

    const loadingTimeoutId = window.setTimeout(() => {
      setBeachProfilesById((prev) => ({
        ...prev,
        [selectedBeachId]: {
          status: "loading",
          data: prev[selectedBeachId]?.data ?? null,
          fetchedAt: prev[selectedBeachId]?.fetchedAt ?? 0,
        },
      }));
    }, 0);

    const controller = new AbortController();
    void fetchBeachProfile(selectedBeachId, controller.signal).then((result) => {
      if (!active) return;
      setBeachProfilesById((prev) => ({
        ...prev,
        [selectedBeachId]: {
          status: result.ok ? "ready" : "error",
          data: result.ok ? result.profile : prev[selectedBeachId]?.data ?? null,
          fetchedAt: Date.now(),
        },
      }));
    });

    return () => {
      active = false;
      window.clearTimeout(loadingTimeoutId);
      controller.abort();
    };
  }, [cacheTtlMs, isLidoModalOpen, selectedBeachId]);

  const selectedBeachProfileEntry = useMemo(
    () => (selectedBeachId ? beachProfilesById[selectedBeachId] : undefined),
    [beachProfilesById, selectedBeachId],
  );
  const selectedBeachProfile = selectedBeachProfileEntry?.data ?? null;
  const selectedBeachProfileLoading = selectedBeachProfileEntry?.status === "loading";

  return {
    selectedBeachProfile,
    selectedBeachProfileLoading,
  };
};
