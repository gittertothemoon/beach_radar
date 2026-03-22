import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppWebScreen } from "./src/screens/AppWebScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { WeatherScreen } from "./src/screens/WeatherScreen";

export type RootTabParamList = {
  MapWeb: undefined;
  Reports: undefined;
  Weather: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

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
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#e2e8f0",
          headerTitleStyle: { fontWeight: "700" },
          sceneStyle: { backgroundColor: "#020617" },
          tabBarStyle: {
            backgroundColor: "#0f172a",
            borderTopColor: "rgba(148, 163, 184, 0.35)",
          },
          tabBarActiveTintColor: "#22d3ee",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarLabelStyle: { fontWeight: "700", fontSize: 12 },
        }}
      >
        <Tab.Screen
          name="MapWeb"
          component={AppWebScreen}
          options={{ title: "Mappa", headerShown: false }}
        />
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ title: "Segnalazioni" }}
        />
        <Tab.Screen
          name="Weather"
          component={WeatherScreen}
          options={{ title: "Meteo" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
