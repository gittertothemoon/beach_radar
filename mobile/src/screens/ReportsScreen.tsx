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
import { beachLevelLabel, crowdLevelLabel, waterLevelLabel } from "../lib/labels";
import { formatDateTime } from "../lib/format";
import { fetchMobileReports, submitMobileReport } from "../services/reports";
import type {
  BeachLevel,
  CrowdLevel,
  MobileReport,
  WaterLevel,
} from "../types/domain";

type FlashMessage =
  | { kind: "neutral"; text: string }
  | { kind: "error"; text: string }
  | { kind: "success"; text: string };

const crowdLevels: CrowdLevel[] = [1, 2, 3, 4];
const waterLevels: WaterLevel[] = [1, 2, 3, 4];
const beachLevels: BeachLevel[] = [1, 2, 3];

export const ReportsScreen = () => {
  const [selectedBeachId, setSelectedBeachId] = useState(beaches[0]?.id ?? "");
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>(2);
  const [waterCondition, setWaterCondition] = useState<WaterLevel | null>(null);
  const [beachCondition, setBeachCondition] = useState<BeachLevel | null>(null);
  const [reports, setReports] = useState<MobileReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<FlashMessage>({
    kind: "neutral",
    text: "Carica le ultime segnalazioni e inviane una nuova.",
  });

  const selectedBeach = useMemo(
    () => beaches.find((beach) => beach.id === selectedBeachId) ?? beaches[0],
    [selectedBeachId],
  );

  const visibleReports = useMemoReports(reports, selectedBeach?.id ?? "");

  const loadReports = useCallback(async () => {
    setLoading(true);
    const result = await fetchMobileReports();
    setLoading(false);

    if (!result.ok) {
      if (result.code === "timeout") {
        setFlash({
          kind: "error",
          text: "Richiesta scaduta. Riprova tra poco.",
        });
        return;
      }
      setFlash({
        kind: "error",
        text: "Impossibile leggere le segnalazioni ora.",
      });
      return;
    }

    setReports(result.reports);
    setFlash({
      kind: "neutral",
      text: `${result.reports.length} segnalazioni caricate.`,
    });
  }, []);

  const submit = useCallback(async () => {
    if (!selectedBeach) return;
    setSubmitting(true);

    const result = await submitMobileReport({
      beachId: selectedBeach.id,
      crowdLevel,
      waterCondition: waterCondition ?? undefined,
      beachCondition: beachCondition ?? undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.code === "too_soon") {
        setFlash({
          kind: "error",
          text:
            result.retryAfterSec && result.retryAfterSec > 0
              ? `Hai già inviato da poco. Riprova tra ${result.retryAfterSec}s.`
              : "Hai già inviato da poco. Riprova più tardi.",
        });
        return;
      }

      setFlash({
        kind: "error",
        text:
          result.code === "timeout"
            ? "Invio scaduto per timeout."
            : "Invio non riuscito.",
      });
      return;
    }

    setReports((prev) => [result.report, ...prev]);
    setFlash({
      kind: "success",
      text: "Segnalazione inviata con successo.",
    });
  }, [beachCondition, crowdLevel, selectedBeach, waterCondition]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Segnalazioni native</Text>
        <Text style={styles.subtitle}>
          Feed e invio report usano `/api/reports` direttamente dall’app mobile.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spiaggia</Text>
          <View style={styles.chipsWrap}>
            {beaches.map((beach) => {
              const active = beach.id === selectedBeach?.id;
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
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Ultime segnalazioni</Text>
            <Pressable style={styles.smallAction} onPress={loadReports} disabled={loading}>
              <Text style={styles.smallActionLabel}>Aggiorna</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color="#22d3ee" />
            </View>
          ) : visibleReports.length === 0 ? (
            <Text style={styles.emptyLabel}>Nessuna segnalazione recente per questa spiaggia.</Text>
          ) : (
            <View style={styles.reportList}>
              {visibleReports.map((report) => (
                <View key={report.id} style={styles.reportRow}>
                  <Text style={styles.reportHead}>
                    Affluenza: {crowdLevelLabel(report.crowdLevel)}
                  </Text>
                  <Text style={styles.reportMeta}>
                    Acqua:{" "}
                    {report.waterCondition ? waterLevelLabel(report.waterCondition) : "n/d"} ·
                    Spiaggia:{" "}
                    {report.beachCondition ? beachLevelLabel(report.beachCondition) : "n/d"}
                  </Text>
                  <Text style={styles.reportMeta}>{formatDateTime(report.createdAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nuovo report</Text>
          <Text style={styles.groupLabel}>Affluenza</Text>
          <View style={styles.inlineOptions}>
            {crowdLevels.map((level) => (
              <Pressable
                key={`crowd-${level}`}
                style={[
                  styles.levelChip,
                  crowdLevel === level ? styles.levelChipActive : null,
                ]}
                onPress={() => setCrowdLevel(level)}
              >
                <Text
                  style={[
                    styles.levelChipLabel,
                    crowdLevel === level ? styles.levelChipLabelActive : null,
                  ]}
                >
                  {crowdLevelLabel(level)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.groupLabel}>Mare (opzionale)</Text>
          <View style={styles.inlineOptions}>
            <NullableChip
              active={waterCondition === null}
              label="n/d"
              onPress={() => setWaterCondition(null)}
            />
            {waterLevels.map((level) => (
              <Pressable
                key={`water-${level}`}
                style={[
                  styles.levelChip,
                  waterCondition === level ? styles.levelChipActive : null,
                ]}
                onPress={() => setWaterCondition(level)}
              >
                <Text
                  style={[
                    styles.levelChipLabel,
                    waterCondition === level ? styles.levelChipLabelActive : null,
                  ]}
                >
                  {waterLevelLabel(level)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.groupLabel}>Spiaggia (opzionale)</Text>
          <View style={styles.inlineOptions}>
            <NullableChip
              active={beachCondition === null}
              label="n/d"
              onPress={() => setBeachCondition(null)}
            />
            {beachLevels.map((level) => (
              <Pressable
                key={`beach-${level}`}
                style={[
                  styles.levelChip,
                  beachCondition === level ? styles.levelChipActive : null,
                ]}
                onPress={() => setBeachCondition(level)}
              >
                <Text
                  style={[
                    styles.levelChipLabel,
                    beachCondition === level ? styles.levelChipLabelActive : null,
                  ]}
                >
                  {beachLevelLabel(level)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.submitButton} onPress={submit} disabled={submitting}>
            <Text style={styles.submitLabel}>
              {submitting ? "Invio in corso..." : "Invia segnalazione"}
            </Text>
          </Pressable>
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

const NullableChip = ({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) => {
  return (
    <Pressable style={[styles.levelChip, active ? styles.levelChipActive : null]} onPress={onPress}>
      <Text style={[styles.levelChipLabel, active ? styles.levelChipLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
};

const useMemoReports = (
  reports: MobileReport[],
  beachId: string,
) =>
  useMemo(
    () =>
      reports
        .filter((report) => report.beachId === beachId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12),
    [beachId, reports],
  );

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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  smallAction: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  smallActionLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  loader: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  reportList: {
    gap: 8,
  },
  reportRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.55)",
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  reportHead: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  reportMeta: {
    color: "#94a3b8",
    fontSize: 12,
  },
  groupLabel: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inlineOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#020617",
  },
  levelChipActive: {
    borderColor: "rgba(34, 211, 238, 0.78)",
    backgroundColor: "rgba(34, 211, 238, 0.18)",
  },
  levelChipLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  levelChipLabelActive: {
    color: "#67e8f9",
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "#06b6d4",
    paddingVertical: 13,
    alignItems: "center",
  },
  submitLabel: {
    color: "#042f2e",
    fontWeight: "800",
    fontSize: 14,
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
