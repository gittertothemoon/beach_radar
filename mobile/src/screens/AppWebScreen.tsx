import { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebSurface } from "../components/WebSurface";
import { MOBILE_APP_ACCESS_KEY, MOBILE_APP_URL, MOBILE_BASE_URL } from "../config/env";

const MOBILE_SCHEME = "where2beach:";

const normalizePathValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const target = new URL(trimmed);
      const base = new URL(MOBILE_BASE_URL);
      if (target.origin !== base.origin) return null;
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return null;
    }
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const buildInAppWebUrl = (pathValue: string): string | null => {
  const normalizedPath = normalizePathValue(pathValue);
  if (!normalizedPath) return null;
  try {
    const target = new URL(normalizedPath, MOBILE_BASE_URL);
    target.searchParams.set("native_shell", "1");
    return target.toString();
  } catch {
    return null;
  }
};

const resolveDeepLinkTarget = (rawUrl: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== MOBILE_SCHEME) return null;

  const pathParam = parsed.searchParams.get("path");
  if (parsed.hostname === "open" && pathParam) {
    return buildInAppWebUrl(pathParam);
  }

  const hostPrefix = parsed.hostname ? `/${parsed.hostname}` : "";
  const fallbackPath = `${hostPrefix}${parsed.pathname || ""}`;
  if (!fallbackPath || fallbackPath === "/") return null;
  const target = buildInAppWebUrl(fallbackPath);
  if (!target) return null;

  try {
    const merged = new URL(target);
    parsed.searchParams.forEach((value, key) => {
      merged.searchParams.set(key, value);
    });
    merged.searchParams.set("native_shell", "1");
    return merged.toString();
  } catch {
    return target;
  }
};

export const AppWebScreen = () => {
  const [currentUrl, setCurrentUrl] = useState(MOBILE_APP_URL);

  const applyIncomingDeepLink = useCallback((rawUrl: string | null) => {
    if (!rawUrl) return;
    const target = resolveDeepLinkTarget(rawUrl);
    if (!target) return;
    setCurrentUrl(target);
  }, []);

  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((rawUrl) => {
      if (!active) return;
      applyIncomingDeepLink(rawUrl);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      applyIncomingDeepLink(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [applyIncomingDeepLink]);

  if (!MOBILE_APP_ACCESS_KEY) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <View style={styles.content}>
          <Text style={styles.title}>Configurazione richiesta</Text>
          <Text style={styles.body}>
            L&apos;app mobile apre direttamente la mappa definitiva (`/app/`).
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
      initialUrl={currentUrl}
      blockLandingRedirect
      landingBlockedMessage="Chiave app non valida o scaduta. Aggiorna EXPO_PUBLIC_APP_ACCESS_KEY e riapri."
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
