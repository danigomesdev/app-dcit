import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { useTheme } from "@/hooks/use-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(outline: IconName, filled: IconName) {
  function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.secondary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Ponto", tabBarIcon: tabIcon("time-outline", "time") }}
      />
      <Tabs.Screen
        name="banco-de-horas"
        options={{
          title: "Banco de Horas",
          tabBarIcon: tabIcon("hourglass-outline", "hourglass"),
        }}
      />
      <Tabs.Screen
        name="ferias"
        options={{ title: "Férias", tabBarIcon: tabIcon("sunny-outline", "sunny") }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: "Documentos",
          tabBarIcon: tabIcon("document-text-outline", "document-text"),
        }}
      />
      <Tabs.Screen
        name="mural"
        options={{ title: "Mural", tabBarIcon: tabIcon("megaphone-outline", "megaphone") }}
      />
    </Tabs>
  );
}
