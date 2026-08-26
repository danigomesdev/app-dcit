import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function HistoricoScreen() {
  const { entries } = usePonto();
  const theme = useTheme();

  const sorted = [...entries].sort(
    (a, b) => new Date(b.clockedAt).getTime() - new Date(a.clockedAt).getTime(),
  );

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Histórico de pontos" />
      {sorted.length === 0 ? (
        <EmptyState
          glyph="🕐"
          title="Nenhum ponto registrado ainda"
          description="Toque em Bater Ponto na aba Ponto para começar a registrar."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sorted.map((entry) => {
            const date = new Date(entry.clockedAt);
            return (
              <View
                key={entry.id}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}
              >
                <Ionicons name="time-outline" size={20} color={theme.secondary} />
                <View style={styles.rowContent}>
                  <ThemedText type="smallBold">
                    {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    gap: 2,
  },
});
