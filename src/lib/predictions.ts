export type PredictionFactors = {
  baseline: number;
  weekendBonus: boolean;
  holidayBonus: boolean;
  seasonBonus: boolean;
  tempModifier: number;
  rainModifier: number;
  windModifier: number;
  realtimeTrend: number;
};

export type CrowdPrediction = {
  targetTime: string;
  crowdIndex: number;
  confidence: number;
  factors: PredictionFactors;
};

export async function fetchBeachPredictions(
  beachId: string,
  lat: number | null,
  lng: number | null,
  hours = 8,
): Promise<{ ok: true; predictions: CrowdPrediction[] } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({ beach_id: beachId, hours: String(hours) });
    if (lat !== null && Number.isFinite(lat)) params.set("lat", lat.toFixed(5));
    if (lng !== null && Number.isFinite(lng)) params.set("lng", lng.toFixed(5));

    const res = await fetch(`/api/predictions?${params.toString()}`);
    if (!res.ok) return { ok: false, error: "fetch_failed" };

    const data = (await res.json()) as { ok: boolean; predictions?: unknown; error?: string };
    if (!data.ok) return { ok: false, error: (data.error ?? "unknown") as string };
    if (!Array.isArray(data.predictions)) return { ok: false, error: "invalid_response" };

    return { ok: true, predictions: data.predictions as CrowdPrediction[] };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export function crowdIndexToColorClass(index: number): string {
  if (index <= 25) return "bg-emerald-500/30 text-emerald-200 border-emerald-400/40";
  if (index <= 50) return "bg-amber-500/30 text-amber-200 border-amber-400/40";
  if (index <= 75) return "bg-orange-500/30 text-orange-200 border-orange-400/40";
  return "bg-red-500/30 text-red-200 border-red-400/40";
}

export function crowdIndexToDotClass(index: number): string {
  if (index <= 25) return "bg-emerald-400";
  if (index <= 50) return "bg-amber-400";
  if (index <= 75) return "bg-orange-500";
  return "bg-red-500";
}

export function formatPredictionHour(isoString: string, timezone?: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone ?? "Europe/Rome",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export function minConfidence(predictions: CrowdPrediction[]): number {
  if (predictions.length === 0) return 0;
  return Math.min(...predictions.map((p) => p.confidence));
}
