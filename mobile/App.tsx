import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppWebScreen } from "./src/screens/AppWebScreen";

export type RootStackParamList = {
  MapWeb: undefined;
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
        <Stack.Screen
          name="MapWeb"
          component={AppWebScreen}
          options={{ title: "Where2Beach" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
