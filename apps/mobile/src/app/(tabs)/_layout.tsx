import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Ponto" }} />
      <Tabs.Screen name="banco-de-horas" options={{ title: "Banco de Horas" }} />
      <Tabs.Screen name="ferias" options={{ title: "Férias" }} />
      <Tabs.Screen name="documentos" options={{ title: "Documentos" }} />
      <Tabs.Screen name="mural" options={{ title: "Mural" }} />
    </Tabs>
  );
}
