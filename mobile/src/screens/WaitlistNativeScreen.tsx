import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { submitWaitlist } from "../services/waitlist";

type WaitlistFlash =
  | { kind: "neutral"; text: string }
  | { kind: "error"; text: string }
  | { kind: "success"; text: string };

export const WaitlistNativeScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<WaitlistFlash>({
    kind: "neutral",
    text: "Inserisci la tua email per entrare in waitlist.",
  });

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    const result = await submitWaitlist(email);
    setLoading(false);

    if (!result.ok) {
      if (result.code === "invalid_email") {
        setFlash({
          kind: "error",
          text: "Email non valida.",
        });
        return;
      }

      if (result.code === "rate_limited") {
        setFlash({
          kind: "error",
          text:
            result.retryAfterSec && result.retryAfterSec > 0
              ? `Troppi tentativi. Riprova tra ${result.retryAfterSec}s.`
              : "Troppi tentativi. Riprova tra poco.",
        });
        return;
      }

      setFlash({
        kind: "error",
        text:
          result.code === "timeout"
            ? "Timeout invio, riprova."
            : "Invio non disponibile al momento.",
      });
      return;
    }

    setFlash({
      kind: "success",
      text: result.already
        ? "Email già presente in waitlist: aggiornamento registrato."
        : "Iscrizione completata con successo.",
    });
    if (!result.already) {
      setEmail("");
    }
  }, [email]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Waitlist nativa</Text>
          <Text style={styles.subtitle}>
            Form mobile diretto su `/api/waitlist` con validazione e gestione rate limit.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@email.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              editable={!loading}
            />
            <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.submitLabel}>Invia</Text>
            </Pressable>
            {loading ? (
              <View style={styles.loader}>
                <ActivityIndicator color="#22d3ee" />
              </View>
            ) : null}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  label: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "#020617",
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#06b6d4",
    paddingVertical: 12,
    alignItems: "center",
  },
  submitLabel: {
    color: "#042f2e",
    fontSize: 14,
    fontWeight: "800",
  },
  loader: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
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
