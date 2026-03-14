import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebSurface } from "../components/WebSurface";
import { MOBILE_APP_ACCESS_KEY, MOBILE_APP_URL, MOBILE_BASE_URL } from "../config/env";

export const AppWebScreen = () => {
  if (!MOBILE_APP_ACCESS_KEY) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <View style={styles.content}>
          <Text style={styles.title}>Configurazione richiesta</Text>
          <Text style={styles.body}>
            L&apos;app mobile apre direttamente la mappa definitiva (`/app/`) e non la waitlist.
            Per autorizzare l&apos;accesso devi impostare `EXPO_PUBLIC_APP_ACCESS_KEY` in
            `mobile/.env`.
          </Text>
          <Text style={styles.hint}>Base URL corrente: {MOBILE_BASE_URL}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <WebSurface
      title="Mappa spiagge"
      initialUrl={MOBILE_APP_URL}
      blockWaitlistRedirect
      waitlistBlockedMessage="Chiave app non valida o scaduta. Aggiorna EXPO_PUBLIC_APP_ACCESS_KEY e riapri."
    />
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    padding: 14,
    gap: 8,
  },
  title: {
    color: "#fecaca",
    fontWeight: "800",
    fontSize: 16,
  },
  body: {
    color: "#fee2e2",
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    marginTop: 4,
    color: "#fca5a5",
    fontSize: 12,
  },
});
