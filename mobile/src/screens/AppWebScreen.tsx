import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
// Register background task — must be imported at module level before use
import "../tasks/nearbyBeachTask";
import { requestBackgroundLocationPermission, updateNearbyGeofences } from "../services/geofencing";
import { schedulePeriodicReminders } from "../services/periodicReminders";
import beachesData from "../data/beaches.json";
import { WebSurface } from "../components/WebSurface";
import {
  MOBILE_APP_ACCESS_KEY,
  MOBILE_APP_URL,
  MOBILE_BASE_URL,
  MOBILE_BASE_URL_IS_LOCAL,
} from "../config/env";
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  resetOnboarding,
} from "../services/onboarding";
import { checkForUpdate, dismissUpdate } from "../services/updateCheck";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MOBILE_SCHEME = "where2beach:";
type AppWebScreenProps = {
  onInitialWebReady?: () => void;
};

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

export const AppWebScreen = ({ onInitialWebReady }: AppWebScreenProps) => {
  const [currentUrl, setCurrentUrl] = useState(MOBILE_APP_URL);
  const [showFirstRunTutorial, setShowFirstRunTutorial] = useState<boolean | null>(
    null,
  );
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const restartTutorialFrameRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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

  useEffect(() => {
    let active = true;
    void hasCompletedOnboarding().then((completed) => {
      if (!active) return;
      setShowFirstRunTutorial(!completed);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (restartTutorialFrameRef.current == null) return;
      cancelAnimationFrame(restartTutorialFrameRef.current);
      restartTutorialFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Request push notification permissions and get token (iOS/Android only).
    if (Platform.OS === "web") return;
    void (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;
        const tokenData = await Notifications.getExpoPushTokenAsync();
        setExpoPushToken(tokenData.data);
      } catch {
        // Non-fatal: push notifications are optional
      }
    })();
  }, []);

  // Set up geofencing for nearby beaches + periodic reminders
  useEffect(() => {
    if (Platform.OS === "web") return;
    void (async () => {
      try {
        const granted = await requestBackgroundLocationPermission();
        if (!granted) return;

        // Get current location and register nearest geofences
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await updateNearbyGeofences(loc.coords.latitude, loc.coords.longitude, beachesData);

        // Schedule friendly periodic reminders
        await schedulePeriodicReminders();
      } catch {
        // Non-fatal
      }
    })();

    // Refresh geofences when app comes to foreground
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((loc) => updateNearbyGeofences(loc.coords.latitude, loc.coords.longitude, beachesData))
          .catch(() => {});
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (MOBILE_BASE_URL_IS_LOCAL) return;
    void checkForUpdate().then((result) => {
      if (!result.hasUpdate) return;
      Alert.alert(
        "Aggiornamento disponibile",
        `La versione ${result.storeVersion} è disponibile su App Store.`,
        [
          {
            text: "Non ora",
            style: "cancel",
            onPress: () => { void dismissUpdate(result.storeVersion); },
          },
          {
            text: "Aggiorna",
            onPress: () => { void Linking.openURL(result.storeUrl); },
          },
        ],
      );
    });
  }, []);

  const handleCompleteTutorial = useCallback(() => {
    setShowFirstRunTutorial(false);
    void markOnboardingCompleted();
  }, []);

  const handleRestartTutorial = useCallback(() => {
    if (restartTutorialFrameRef.current != null) {
      cancelAnimationFrame(restartTutorialFrameRef.current);
      restartTutorialFrameRef.current = null;
    }

    // Force a fresh false->true transition so the overlay always restarts from step 1.
    setShowFirstRunTutorial(false);
    void resetOnboarding();

    restartTutorialFrameRef.current = requestAnimationFrame(() => {
      restartTutorialFrameRef.current = null;
      setShowFirstRunTutorial(true);
    });
  }, []);

  if (!MOBILE_APP_ACCESS_KEY && !MOBILE_BASE_URL_IS_LOCAL) {
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
    <>
      <WebSurface
        initialUrl={currentUrl}
        blockLandingRedirect
        landingBlockedMessage="Chiave app non valida o configurazione backend incompleta. Verifica EXPO_PUBLIC_APP_ACCESS_KEY su mobile e APP_ACCESS_KEY/APP_ACCESS_KEY_HASH sulle API."
        firstRunTutorialEnabled={showFirstRunTutorial === true}
        onCompleteFirstRunTutorial={handleCompleteTutorial}
        onRestartTutorial={handleRestartTutorial}
        onInitialLoadSettled={onInitialWebReady}
        expoPushToken={expoPushToken}
      />
    </>
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
