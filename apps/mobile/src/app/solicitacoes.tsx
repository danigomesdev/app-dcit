import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function SolicitacoesScreen() {
  const { adjustmentRequests } = usePonto();
  const theme = useTheme();

  const sorted = [...adjustmentRequests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Solicitações de ajustes" />
      {sorted.length === 0 ? (
        <EmptyState
          glyph="📝"
          title="Nenhuma solicitação ainda"
          description="Solicitações criadas em Ajustar meu ponto aparecem aqui."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sorted.map((request) => (
            <View
              key={request.id}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="create-outline" size={20} color={theme.secondary} />
              <View style={styles.rowContent}>
                <ThemedText type="smallBold">{request.reason}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(request.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                  })}{" "}
                  · Pendente
                </ThemedText>
              </View>
            </View>
          ))}
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
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
});
