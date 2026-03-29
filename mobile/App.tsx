import { useCallback, useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Image, StyleSheet, View } from "react-native";
import { AppWebScreen } from "./src/screens/AppWebScreen";

export type RootStackParamList = {
  MapWeb: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const MIN_SPLASH_VISIBLE_MS = 680;

void SplashScreen.setOptions({
  duration: 0,
  fade: false,
});

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen is already controlled by the runtime.
});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#020617",
    card: "#0f172a",
    primary: "#06b6d4",
    text: "#e2e8f0",
    border: "rgba(148, 163, 184, 0.3)",
  },
};

export default function App() {
  const [isBootReady, setIsBootReady] = useState(false);
  const [mountNavigation, setMountNavigation] = useState(false);
  const bootReadyRef = useRef(false);
  const splashStartTimeRef = useRef(Date.now());

  const handleInitialWebReady = useCallback(() => {
    if (bootReadyRef.current) return;
    bootReadyRef.current = true;
    setIsBootReady(true);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMountNavigation(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isBootReady) return;
    const elapsed = Date.now() - splashStartTimeRef.current;
    const waitMs = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsed);
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void SplashScreen.hideAsync().catch(() => {
            // Ignore splash hide errors.
          });
        });
      });
    }, waitMs);
    return () => {
      clearTimeout(timer);
    };
  }, [isBootReady]);

  return (
    <View style={styles.root}>
      {mountNavigation ? (
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#020617" },
            }}
          >
            <Stack.Screen name="MapWeb">
              {() => <AppWebScreen onInitialWebReady={handleInitialWebReady} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <View style={styles.placeholder} />
      )}

      {!isBootReady ? (
        <View style={styles.bootstrapLayer} pointerEvents="none">
          <Image
            source={require("./assets/splash-icon.png")}
            style={styles.bootstrapLogo}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#020617",
  },
  bootstrapLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  bootstrapLogo: {
    width: 360,
    height: 360,
  },
});
