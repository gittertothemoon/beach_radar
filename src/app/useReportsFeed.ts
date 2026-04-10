import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { fetchSharedReports } from "../lib/reports";
import type { Report } from "../lib/types";

// Must match server DEFAULT_REPORTS_LOOKBACK_HOURS
const LOOKBACK_MS = 6 * 60 * 60 * 1000;

type UseReportsFeedInput = {
  setReports: Dispatch<SetStateAction<Report[]>>;
  setReportsFeedReady: Dispatch<SetStateAction<boolean>>;
  pollMs: number;
  graceMs: number;
  onUnavailable: () => void;
};

export const useReportsFeed = ({
  setReports,
  setReportsFeedReady,
  pollMs,
  graceMs,
  onUnavailable,
}: UseReportsFeedInput): void => {
  const reportsUnavailableToastShownRef = useRef(false);
  const reportsFeedReadyRef = useRef(false);
  const reportsFeedGraceElapsedRef = useRef(false);

  useEffect(() => {
    let active = true;
    reportsFeedGraceElapsedRef.current = false;

    const graceTimeoutId = window.setTimeout(() => {
      reportsFeedGraceElapsedRef.current = true;
    }, graceMs);

    const syncReports = async () => {
      const result = await fetchSharedReports();
      if (!active) return;

      if (result.ok) {
        setReports((prev) => {
          // Merge: server reports are authoritative, but keep locally-submitted
          // reports that aren't yet reflected in the server response (CDN cache lag).
          // They're dropped naturally once the server confirms them (same id) or
          // once they fall outside the lookback window.
          const serverIds = new Set(result.reports.map((r) => r.id));
          const cutoff = Date.now() - LOOKBACK_MS;
          const localOnly = prev.filter(
            (r) => !serverIds.has(r.id) && r.createdAt >= cutoff,
          );
          return localOnly.length > 0
            ? [...result.reports, ...localOnly]
            : result.reports;
        });
        reportsFeedReadyRef.current = true;
        setReportsFeedReady(true);
        reportsUnavailableToastShownRef.current = false;
        return;
      }

      const canShowUnavailableToast =
        reportsFeedReadyRef.current || reportsFeedGraceElapsedRef.current;
      if (!canShowUnavailableToast) return;

      if (!reportsUnavailableToastShownRef.current) {
        reportsUnavailableToastShownRef.current = true;
        onUnavailable();
      }
    };

    void syncReports();
    const intervalId = window.setInterval(() => {
      void syncReports();
    }, pollMs);

    return () => {
      active = false;
      window.clearTimeout(graceTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [graceMs, onUnavailable, pollMs, setReports, setReportsFeedReady]);
};
