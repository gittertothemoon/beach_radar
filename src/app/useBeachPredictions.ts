import { useEffect, useState } from "react";
import { fetchBeachPredictions, type CrowdPrediction } from "../lib/predictions";

export function useBeachPredictions({
  selectedBeachId,
  selectedBeachLat,
  selectedBeachLng,
  isLidoModalOpen,
}: {
  selectedBeachId: string | null;
  selectedBeachLat: number | null;
  selectedBeachLng: number | null;
  isLidoModalOpen: boolean;
}) {
  const [predictions, setPredictions] = useState<CrowdPrediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const active = Boolean(selectedBeachId) && isLidoModalOpen;

  useEffect(() => {
    if (!active || !selectedBeachId) return;

    let cancelled = false;
    // Loading flag is set synchronously so the UI can show the spinner
    // before the network call resolves; deferring it causes a flash of
    // stale data on beach switch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPredictionsLoading(true);

    fetchBeachPredictions(selectedBeachId, selectedBeachLat, selectedBeachLng).then(
      (result) => {
        if (cancelled) return;
        setPredictions(result.ok ? result.predictions : []);
        setPredictionsLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [active, selectedBeachId, selectedBeachLat, selectedBeachLng]);

  return {
    predictions: active ? predictions : [],
    predictionsLoading: active ? predictionsLoading : false,
  };
}
