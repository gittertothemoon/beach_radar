import { Pressable, StyleSheet, Text, View } from "react-native";
import { MOBILE_APP_ACCESS_KEY, MOBILE_BASE_URL } from "../config/env";

type HomeScreenProps = {
  onOpenMapWeb: () => void;
  onOpenReports: () => void;
  onOpenWeather: () => void;
  onOpenWaitlistNative: () => void;
};

export const HomeScreen = ({
  onOpenMapWeb,
  onOpenReports,
  onOpenWeather,
  onOpenWaitlistNative,
}: HomeScreenProps) => {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.badge}>Where2Beach Mobile</Text>
        <Text style={styles.title}>Fase 2 mobile</Text>
        <Text style={styles.subtitle}>
          Base URL: {MOBILE_BASE_URL}
        </Text>
        <Text style={styles.subtitle}>
          Access key: {MOBILE_APP_ACCESS_KEY ? "configurata" : "non configurata"}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onOpenReports}>
          <Text style={styles.primaryLabel}>Segnalazioni native</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onOpenWeather}>
          <Text style={styles.secondaryLabel}>Meteo nativo</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onOpenWaitlistNative}>
          <Text style={styles.secondaryLabel}>Waitlist nativa</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={onOpenMapWeb}>
          <Text style={styles.ghostLabel}>Apri mappa web</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        La fase 2 sposta i flussi core su UI native mantenendo la mappa web per copertura
        completa mentre evolviamo il layer map in nativo.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  hero: {
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.55)",
    backgroundColor: "rgba(8, 47, 73, 0.55)",
    color: "#67e8f9",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: "#06b6d4",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryLabel: {
    color: "#022c22",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  secondaryLabel: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 15,
  },
  ghostButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  ghostLabel: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 14,
  },
  note: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
});
