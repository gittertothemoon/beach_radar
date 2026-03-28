import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type WebSurfaceProps = {
  initialUrl: string;
  blockLandingRedirect?: boolean;
  landingBlockedMessage?: string;
};

const AUTO_RELOAD_MAX_ATTEMPTS = 2;
const AUTO_RELOAD_DELAY_MS = 700;
const PROD_FALLBACK_ORIGIN = "https://where2beach.com";

const isLocalLikeHost = (host: string): boolean => {
  const value = host.toLowerCase();
  if (value === "localhost" || value === "127.0.0.1" || value === "::1") return true;
  if (/^10\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(value);
};

const isNetworkTransientError = (nativeError: {
  code?: number;
  domain?: string;
  description?: string;
}): boolean => {
  const code = typeof nativeError.code === "number" ? nativeError.code : null;
  if (code === -1004 || code === -1001 || code === -1009 || code === -1003) {
    return true;
  }

  const domain = (nativeError.domain ?? "").toLowerCase();
  const description = (nativeError.description ?? "").toLowerCase();
  return (
    domain.includes("nsurlerrordomain") &&
    (description.includes("impossibile connettersi al server") ||
      description.includes("could not connect to the server") ||
      description.includes("offline") ||
      description.includes("timed out"))
  );
};

const withFallbackOrigin = (rawUrl: string, fallbackOrigin: string): string | null => {
  try {
    const current = new URL(rawUrl);
    const fallback = new URL(fallbackOrigin);
    current.protocol = fallback.protocol;
    current.host = fallback.host;
    return current.toString();
  } catch {
    return null;
  }
};

export const WebSurface = ({
  initialUrl,
  blockLandingRedirect = false,
  landingBlockedMessage,
}: WebSurfaceProps) => {
  const insets = useSafeAreaInsets();
  const statusBarOverlayHeight = Math.max(28, insets.top + 2);
  const webViewRef = useRef<WebView>(null);
  const retryAttemptRef = useRef(0);
  const fallbackAppliedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  const source = useMemo(() => ({ uri: currentUrl }), [currentUrl]);
  const appOrigin = useMemo(() => {
    try {
      return new URL(currentUrl).origin;
    } catch {
      return null;
    }
  }, [currentUrl]);

  const isLocalSource = useMemo(() => {
    try {
      return isLocalLikeHost(new URL(currentUrl).hostname);
    } catch {
      return false;
    }
  }, [currentUrl]);

  const resetConnectionState = useCallback(() => {
    retryAttemptRef.current = 0;
    fallbackAppliedRef.current = false;
    setError(null);
    setHasLoadedOnce(false);
    setLoading(true);
  }, []);

  const applySourceUrl = useCallback(
    (nextUrl: string) => {
      resetConnectionState();
      setCurrentUrl(nextUrl);
    },
    [resetConnectionState],
  );

  const handleReload = useCallback(() => {
    setError(null);
    retryAttemptRef.current = 0;
    webViewRef.current?.reload();
  }, []);

  const openExternalUrl = useCallback((rawUrl: string) => {
    setLoading(false);
    setError(null);
    void Linking.openURL(rawUrl).catch(() => {
      setError("Impossibile aprire il link esterno.");
    });
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; isTopFrame?: boolean }) => {
      const isTopFrameRequest = request.isTopFrame !== false;
      const isLandingRequest = /\/landing(\/|$)/i.test(request.url);
      // Guard only the initial app-access handshake redirect.
      if (blockLandingRedirect && !hasLoadedOnce && isTopFrameRequest && isLandingRequest) {
        setLoading(false);
        setError(
          landingBlockedMessage ??
            "Accesso app non autorizzato. Configura la chiave app e riprova.",
        );
        return false;
      }

      if (request.isTopFrame === false) {
        return true;
      }

      const rawUrl = request.url?.trim();
      if (!rawUrl) return true;

      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        parsedUrl = null;
      }

      const isHttp = parsedUrl?.protocol === "http:" || parsedUrl?.protocol === "https:";
      const isExternalHttp =
        isHttp && appOrigin ? parsedUrl?.origin !== appOrigin : false;

      if (!isHttp || isExternalHttp) {
        openExternalUrl(rawUrl);
        return false;
      }
      return true;
    },
    [appOrigin, blockLandingRedirect, hasLoadedOnce, landingBlockedMessage, openExternalUrl],
  );

  const handleWebError = useCallback(
    (event: {
      nativeEvent: {
        code?: number;
        domain?: string;
        description?: string;
      };
    }) => {
      const nativeError = event.nativeEvent ?? {};
      const transientNetworkError = isNetworkTransientError(nativeError);

      if (transientNetworkError && retryAttemptRef.current < AUTO_RELOAD_MAX_ATTEMPTS) {
        retryAttemptRef.current += 1;
        setError(null);
        setLoading(true);
        const waitMs = AUTO_RELOAD_DELAY_MS * retryAttemptRef.current;
        setTimeout(() => {
          webViewRef.current?.reload();
        }, waitMs);
        return;
      }

      if (transientNetworkError && isLocalSource && !fallbackAppliedRef.current) {
        const fallbackUrl = withFallbackOrigin(currentUrl, PROD_FALLBACK_ORIGIN);
        if (fallbackUrl && fallbackUrl !== currentUrl) {
          fallbackAppliedRef.current = true;
          setError(null);
          setLoading(true);
          setCurrentUrl(fallbackUrl);
          return;
        }
      }

      setLoading(false);
      setHasLoadedOnce(true);
      setError(nativeError.description || "Errore sconosciuto");
    },
    [currentUrl, isLocalSource],
  );

  useEffect(() => {
    if (initialUrl === currentUrl) return;
    applySourceUrl(initialUrl);
  }, [applySourceUrl, currentUrl, initialUrl]);

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        style={[
          styles.statusBarScrim,
          { height: statusBarOverlayHeight },
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
        injectedJavaScriptBeforeContentLoaded={"window.__W2B_NATIVE_SHELL = true; true;"}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          setLoading(false);
          setHasLoadedOnce(true);
          retryAttemptRef.current = 0;
        }}
        onError={handleWebError}
        onOpenWindow={(event) => {
          const targetUrl = event.nativeEvent.targetUrl?.trim();
          if (!targetUrl) return;
          openExternalUrl(targetUrl);
        }}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        style={styles.webview}
      />

      {loading && !hasLoadedOnce && !error ? (
        <View style={styles.loadingLayer} pointerEvents="none">
          <View style={styles.loadingBadge}>
            <Image
              source={require("../../assets/android-icon-foreground.png")}
              style={styles.loadingLogo}
              resizeMode="contain"
            />
          </View>
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
  webview: {
    flex: 1,
    backgroundColor: "#020617",
  },
  loadingLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingBadge: {
    width: 236,
    height: 236,
    borderRadius: 118,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
  },
  loadingLogo: {
    width: 196,
    height: 196,
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
