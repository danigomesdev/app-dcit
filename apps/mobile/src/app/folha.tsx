import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatMinutes, isSameDay, summarizeDay, usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { exportFolhaPdf } from "@/lib/export-folha";

export default function FolhaScreen() {
  const { entries } = usePonto();
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);

  const days = Array.from(new Set(entries.map((entry) => entry.clockedAt.slice(0, 10)))).sort(
    (a, b) => (a < b ? 1 : -1),
  );

  async function handleExport() {
    setExporting(true);
    try {
      const rows = days.map((day) => {
        const dayEntries = entries.filter((entry) => isSameDay(entry.clockedAt, day));
        const { workedMinutes, isOpen } = summarizeDay(dayEntries);
        const date = new Date(`${day}T00:00:00`);
        return {
          label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
          workedMinutes,
          isOpen,
        };
      });
      await exportFolhaPdf(rows);
    } catch {
      Alert.alert("Não foi possível exportar", "Tente novamente em instantes.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader
        title="Folha de ponto"
        actionIcon={exporting ? undefined : "download-outline"}
        actionLabel="Exportar folha de ponto"
        onActionPress={days.length > 0 ? handleExport : undefined}
      />
      {days.length === 0 ? (
        <EmptyState
          glyph="📄"
          title="Nenhum dia registrado ainda"
          description="Sua folha de ponto mostra o resumo de horas trabalhadas por dia."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {days.map((day) => {
            const dayEntries = entries.filter((entry) => isSameDay(entry.clockedAt, day));
            const { workedMinutes, isOpen } = summarizeDay(dayEntries);
            const date = new Date(`${day}T00:00:00`);

            return (
              <View key={day} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="calendar-outline" size={20} color={theme.secondary} />
                <View style={styles.rowContent}>
                  <ThemedText type="smallBold">
                    {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMinutes(workedMinutes)}
                    {isOpen ? " · ponto em aberto" : ""}
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
