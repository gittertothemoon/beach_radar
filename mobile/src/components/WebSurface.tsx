import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

type WebNavigationState = {
  url: string;
};

type WebSurfaceProps = {
  title: string;
  initialUrl: string;
};

export const WebSurface = ({ title, initialUrl }: WebSurfaceProps) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  const source = useMemo(() => ({ uri: initialUrl }), [initialUrl]);

  const handleNavigationChange = useCallback((navigation: WebNavigationState) => {
    setCurrentUrl(navigation.url);
  }, []);

  const handleReload = useCallback(() => {
    setError(null);
    webViewRef.current?.reload();
  }, []);

  const handleOpenInBrowser = useCallback(() => {
    void Linking.openURL(currentUrl);
  }, [currentUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable style={styles.secondaryButton} onPress={handleOpenInBrowser}>
          <Text style={styles.secondaryButtonLabel}>Apri nel browser</Text>
        </Pressable>
      </View>

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
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onNavigationStateChange={handleNavigationChange}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "#0f172a",
  },
  title: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secondaryButtonLabel: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 12,
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
