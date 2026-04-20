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

  useEffect(() => {
    if (!selectedBeachId || !isLidoModalOpen) {
      setPredictions([]);
      setPredictionsLoading(false);
      return;
    }

    let active = true;
    setPredictionsLoading(true);

    fetchBeachPredictions(selectedBeachId, selectedBeachLat, selectedBeachLng).then(
      (result) => {
        if (!active) return;
        setPredictions(result.ok ? result.predictions : []);
        setPredictionsLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [selectedBeachId, selectedBeachLat, selectedBeachLng, isLidoModalOpen]);

  return { predictions, predictionsLoading };
}
