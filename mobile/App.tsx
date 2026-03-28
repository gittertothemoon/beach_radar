import { useCallback, useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppWebScreen } from "./src/screens/AppWebScreen";

export type RootStackParamList = {
  MapWeb: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const MIN_SPLASH_VISIBLE_MS = 680;

void SplashScreen.setOptions({
  duration: 220,
  fade: true,
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
  const bootReadyRef = useRef(false);
  const splashStartTimeRef = useRef(Date.now());

  const handleInitialWebReady = useCallback(() => {
    if (bootReadyRef.current) return;
    bootReadyRef.current = true;
    setIsBootReady(true);
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
  );
}
