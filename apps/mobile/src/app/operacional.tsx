import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useOperacional } from "@/context/operacional-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { PLANTAO_SEMANA, formatElapsed } from "@/lib/operacional";

export default function OperacionalScreen() {
  const theme = useTheme();
  const {
    sobreavisoActive,
    sobreavisoStartedAt,
    toggleSobreaviso,
    deslocamentoActive,
    deslocamentoStartedAt,
    toggleDeslocamento,
    deslocamentos,
  } = useOperacional();

  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Operacional / TI" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">Escala de plantão desta semana</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {PLANTAO_SEMANA.map((shift) => (
            <View key={shift.day} style={styles.shiftRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.shiftDay}>
                {shift.day}
              </ThemedText>
              <ThemedText type="smallBold">{shift.person}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Sobreaviso
        </ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.statusRow}>
            <Ionicons
              name={sobreavisoActive ? "notifications" : "notifications-outline"}
              size={22}
              color={sobreavisoActive ? theme.success : theme.textSecondary}
            />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">
                {sobreavisoActive ? "Sobreaviso ativo" : "Sobreaviso inativo"}
              </ThemedText>
              {sobreavisoActive && sobreavisoStartedAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Há {formatElapsed(sobreavisoStartedAt)}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedButton
            title={sobreavisoActive ? "Encerrar sobreaviso" : "Ativar sobreaviso"}
            variant={sobreavisoActive ? "accent" : "secondary"}
            onPress={toggleSobreaviso}
          />
        </View>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Deslocamento
        </ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.statusRow}>
            <Ionicons
              name={deslocamentoActive ? "car" : "car-outline"}
              size={22}
              color={deslocamentoActive ? theme.success : theme.textSecondary}
            />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">
                {deslocamentoActive ? "Em deslocamento" : "Sem deslocamento em andamento"}
              </ThemedText>
              {deslocamentoActive && deslocamentoStartedAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Iniciado há {formatElapsed(deslocamentoStartedAt)}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedButton
            title={deslocamentoActive ? "Encerrar deslocamento" : "Iniciar deslocamento"}
            variant={deslocamentoActive ? "accent" : "secondary"}
            onPress={toggleDeslocamento}
          />
        </View>

        {deslocamentos.length > 0 ? (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Deslocamentos de hoje
            </ThemedText>
            {deslocamentos
              .slice()
              .reverse()
              .map((record) => (
                <View
                  key={record.id}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons name="time-outline" size={18} color={theme.secondary} />
                  <ThemedText type="small">
                    {new Date(record.startedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    —{" "}
                    {new Date(record.endedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
              ))}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  shiftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.one,
  },
  shiftDay: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },
});
