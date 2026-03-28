import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { fetchSharedReports } from "../lib/reports";
import type { Report } from "../lib/types";

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
        setReports(result.reports);
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
