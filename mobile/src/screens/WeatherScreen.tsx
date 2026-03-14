import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { beaches } from "../data/beaches";
import { formatRainProbability, formatWeatherHour } from "../lib/format";
import { fetchBeachWeather } from "../services/weather";
import type { WeatherSnapshot } from "../types/domain";

type WeatherFlash =
  | { kind: "neutral"; text: string }
  | { kind: "error"; text: string }
  | { kind: "success"; text: string };

export const WeatherScreen = () => {
  const [selectedBeachId, setSelectedBeachId] = useState(beaches[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [flash, setFlash] = useState<WeatherFlash>({
    kind: "neutral",
    text: "Seleziona una spiaggia e aggiorna il meteo live.",
  });

  const selectedBeach = useMemo(
    () => beaches.find((beach) => beach.id === selectedBeachId) ?? beaches[0],
    [selectedBeachId],
  );

  const loadWeather = useCallback(async () => {
    if (!selectedBeach) return;
    setLoading(true);
    const result = await fetchBeachWeather(selectedBeach.lat, selectedBeach.lng);
    setLoading(false);

    if (!result.ok) {
      setWeather(null);
      setFlash({
        kind: "error",
        text:
          result.code === "timeout"
            ? "Timeout meteo: riprova tra pochi secondi."
            : "Meteo non disponibile adesso.",
      });
      return;
    }

    setWeather(result.weather);
    setFlash({
      kind: "success",
      text: `Meteo aggiornato per ${selectedBeach.name}.`,
    });
  }, [selectedBeach]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Meteo native</Text>
        <Text style={styles.subtitle}>
          Dati in tempo reale da `/api/weather` con fallback di errore/timeout gestito lato app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spiaggia</Text>
          <View style={styles.chipsWrap}>
            {beaches.map((beach) => {
              const active = selectedBeach?.id === beach.id;
              return (
                <Pressable
                  key={beach.id}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => setSelectedBeachId(beach.id)}
                >
                  <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                    {beach.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.refreshButton} onPress={loadWeather} disabled={loading}>
            <Text style={styles.refreshButtonLabel}>
              {loading ? "Aggiornamento..." : "Aggiorna meteo"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color="#22d3ee" />
            </View>
          ) : weather ? (
            <View style={styles.weatherBox}>
              <Text style={styles.currentLabel}>Condizioni attuali</Text>
              <Text style={styles.currentTemp}>{Math.round(weather.current.temperatureC)}°C</Text>
              <Text style={styles.meta}>
                {weather.current.conditionLabel} · Pioggia{" "}
                {formatRainProbability(weather.current.rainProbability)}
              </Text>
              <Text style={styles.meta}>
                Vento {Math.round(weather.current.windKmh)} km/h
                {weather.current.windDirectionLabel
                  ? ` da ${weather.current.windDirectionLabel}`
                  : ""}
              </Text>
              <Text style={styles.meta}>
                Aggiornato: {formatWeatherHour(weather.current.ts, weather.timezone)}
              </Text>

              <Text style={styles.nextLabel}>Prossime ore</Text>
              {weather.nextHours.length === 0 ? (
                <Text style={styles.meta}>Nessuna previsione breve disponibile.</Text>
              ) : (
                weather.nextHours.map((hour) => (
                  <View key={`${hour.ts}`} style={styles.hourRow}>
                    <Text style={styles.hourTitle}>
                      {formatWeatherHour(hour.ts, weather.timezone)}
                    </Text>
                    <Text style={styles.hourMeta}>
                      {Math.round(hour.temperatureC)}°C · {hour.conditionLabel} · pioggia{" "}
                      {formatRainProbability(hour.rainProbability)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : (
            <Text style={styles.emptyLabel}>Nessun dato meteo caricato.</Text>
          )}
        </View>

        <View
          style={[
            styles.flashBox,
            flash.kind === "error"
              ? styles.flashError
              : flash.kind === "success"
                ? styles.flashSuccess
                : styles.flashNeutral,
          ]}
        >
          <Text style={styles.flashText}>{flash.text}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  title: {
    marginTop: 12,
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    gap: 10,
  },
  cardTitle: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#020617",
  },
  chipActive: {
    backgroundColor: "rgba(34, 211, 238, 0.18)",
    borderColor: "rgba(34, 211, 238, 0.8)",
  },
  chipLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: "#67e8f9",
  },
  refreshButton: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "#06b6d4",
    paddingVertical: 12,
    alignItems: "center",
  },
  refreshButtonLabel: {
    color: "#042f2e",
    fontSize: 14,
    fontWeight: "800",
  },
  loader: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  weatherBox: {
    gap: 6,
  },
  currentLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  currentTemp: {
    color: "#e2e8f0",
    fontSize: 34,
    fontWeight: "800",
  },
  meta: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  nextLabel: {
    marginTop: 10,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  hourRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.55)",
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  hourTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
  },
  hourMeta: {
    color: "#94a3b8",
    fontSize: 12,
  },
  emptyLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  flashBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  flashNeutral: {
    borderColor: "rgba(148, 163, 184, 0.4)",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  flashError: {
    borderColor: "rgba(248, 113, 113, 0.6)",
    backgroundColor: "rgba(127, 29, 29, 0.32)",
  },
  flashSuccess: {
    borderColor: "rgba(16, 185, 129, 0.55)",
    backgroundColor: "rgba(6, 95, 70, 0.35)",
  },
  flashText: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 18,
  },
});
