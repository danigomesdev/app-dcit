import { Tabs } from "expo-router";

import { useTheme } from "@/hooks/use-theme";

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
      <Tabs.Screen name="index" options={{ title: "Ponto" }} />
      <Tabs.Screen name="banco-de-horas" options={{ title: "Banco de Horas" }} />
      <Tabs.Screen name="ferias" options={{ title: "Férias" }} />
      <Tabs.Screen name="documentos" options={{ title: "Documentos" }} />
      <Tabs.Screen name="mural" options={{ title: "Mural" }} />
    </Tabs>
  );
}
