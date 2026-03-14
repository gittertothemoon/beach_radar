import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "./src/screens/HomeScreen";
import { AppWebScreen } from "./src/screens/AppWebScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { WeatherScreen } from "./src/screens/WeatherScreen";
import { WaitlistNativeScreen } from "./src/screens/WaitlistNativeScreen";

export type RootStackParamList = {
  Home: undefined;
  MapWeb: undefined;
  Reports: undefined;
  Weather: undefined;
  WaitlistNative: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#e2e8f0",
          contentStyle: { backgroundColor: "#020617" },
        }}
      >
        <Stack.Screen name="Home" options={{ title: "Where2Beach" }}>
          {({ navigation }) => (
            <HomeScreen
              onOpenMapWeb={() => navigation.navigate("MapWeb")}
              onOpenReports={() => navigation.navigate("Reports")}
              onOpenWeather={() => navigation.navigate("Weather")}
              onOpenWaitlistNative={() => navigation.navigate("WaitlistNative")}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="MapWeb"
          component={AppWebScreen}
          options={{ title: "App Spiagge" }}
        />
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ title: "Segnalazioni" }}
        />
        <Stack.Screen
          name="Weather"
          component={WeatherScreen}
          options={{ title: "Meteo" }}
        />
        <Stack.Screen
          name="WaitlistNative"
          component={WaitlistNativeScreen}
          options={{ title: "Waitlist" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
