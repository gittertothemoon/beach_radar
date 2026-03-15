import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type WebSurfaceProps = {
  initialUrl: string;
  blockWaitlistRedirect?: boolean;
  waitlistBlockedMessage?: string;
};

export const WebSurface = ({
  initialUrl,
  blockWaitlistRedirect = false,
  waitlistBlockedMessage,
}: WebSurfaceProps) => {
  const insets = useSafeAreaInsets();
  const statusBarOverlayHeight = Math.max(28, insets.top + 2);
  const statusBarFadeHeight = Platform.OS === "ios" ? 8 : 6;
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const source = useMemo(() => ({ uri: initialUrl }), [initialUrl]);

  const handleReload = useCallback(() => {
    setError(null);
    webViewRef.current?.reload();
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      if (blockWaitlistRedirect && /\/waitlist(\/|$)/i.test(request.url)) {
        setLoading(false);
        setError(
          waitlistBlockedMessage ??
            "Accesso app non autorizzato. Configura la chiave app e riprova.",
        );
        return false;
      }
      return true;
    },
    [blockWaitlistRedirect, waitlistBlockedMessage],
  );

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        style={[
          styles.statusBarScrim,
          { height: statusBarOverlayHeight },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.statusBarGradient,
          {
            top: statusBarOverlayHeight,
            height: statusBarFadeHeight,
          },
        ]}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Connessione non disponibile</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={handleReload}>
            <Text style={styles.primaryButtonLabel}>Riprova</Text>
          </Pressable>
        </View>
      ) : null}

      <WebView
        ref={webViewRef}
        source={source}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={(event) => {
          setLoading(false);
          setError(event.nativeEvent.description || "Errore sconosciuto");
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        startInLoadingState
      />

      {loading ? (
        <View style={styles.loadingLayer} pointerEvents="none">
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text style={styles.loadingLabel}>Caricamento</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  statusBarScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(2, 6, 23, 0.52)",
    zIndex: 5,
  },
  statusBarGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(2, 6, 23, 0.12)",
    zIndex: 4,
  },
  loadingLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  loadingLabel: {
    marginTop: 8,
    color: "#e2e8f0",
    fontWeight: "600",
  },
  errorBox: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: "#fecaca",
    fontWeight: "700",
    fontSize: 14,
  },
  errorBody: {
    color: "#fee2e2",
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
