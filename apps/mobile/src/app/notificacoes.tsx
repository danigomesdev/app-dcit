import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { fetchJornadaAlerts, type JornadaAlertRecord } from "@/lib/alertas-api";
import { currentVacationCycle, daysUntil, formatDate } from "@/lib/ferias";
import { getSessionToken } from "@/lib/session";
import {
  fetchAdjustmentRequests,
  fetchCompensationRequests,
  fetchFerias,
} from "@/lib/solicitacoes-api";

type Notice = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "accent" | "secondary";
  title: string;
  description: string;
};

const VENCIMENTO_ALERT_THRESHOLD_DAYS = 90;

export default function NotificacoesScreen() {
  const theme = useTheme();
  const { entries } = usePonto();
  const [hireDate, setHireDate] = useState<string | null>(null);
  const [pendingVacation, setPendingVacation] = useState(0);
  const [pendingAdjustments, setPendingAdjustments] = useState(0);
  const [pendingCompensation, setPendingCompensation] = useState(0);
  const [jornadaAlerts, setJornadaAlerts] = useState<JornadaAlertRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const [ferias, adjustments, compensations, alerts] = await Promise.all([
          fetchFerias(token),
          fetchAdjustmentRequests(token),
          fetchCompensationRequests(token),
          fetchJornadaAlerts(token),
        ]);
        if (cancelled) return;
        if (ferias) {
          setHireDate(ferias.hireDate);
          setPendingVacation(ferias.requests.filter((r) => r.status === "pendente").length);
        }
        if (adjustments) setPendingAdjustments(adjustments.length);
        if (compensations) setPendingCompensation(compensations.length);
        if (alerts) setJornadaAlerts(alerts);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const notices = useMemo<Notice[]>(() => {
    const list: Notice[] = [];

    const cycle = currentVacationCycle(hireDate ? new Date(hireDate) : undefined);
    const daysToVencimento = daysUntil(cycle.vencimento);
    if (daysToVencimento <= VENCIMENTO_ALERT_THRESHOLD_DAYS) {
      list.push({
        id: "ferias-vencendo",
        icon: "warning-outline",
        tone: "accent",
        title: "Suas férias estão vencendo",
        description: `Vencem em ${formatDate(cycle.vencimento)} (${daysToVencimento} dias). Agende antes do prazo.`,
      });
    }

    const pendingSync = entries.filter((entry) => entry.synced === false).length;
    if (pendingSync > 0) {
      list.push({
        id: "pontos-pendentes",
        icon: "cloud-offline-outline",
        tone: "accent",
        title: "Pontos aguardando sincronização",
        description: `${pendingSync} ponto(s) registrado(s) offline ainda não confirmado(s) pelo servidor.`,
      });
    }

    for (const alert of jornadaAlerts) {
      list.push({
        id: `jornada-${alert.id}`,
        icon: "alert-circle-outline",
        tone: "accent",
        title:
          alert.type === "interjornada"
            ? "Intervalo entre turnos não cumprido"
            : "Intervalo de almoço não cumprido",
        description: `${formatDate(new Date(alert.date))} — faltaram ${alert.minutesShort} min para o mínimo exigido.`,
      });
    }

    const totalPending = pendingVacation + pendingAdjustments + pendingCompensation;
    if (totalPending > 0) {
      list.push({
        id: "solicitacoes-pendentes",
        icon: "time-outline",
        tone: "secondary",
        title: "Solicitações em andamento",
        description: `Você tem ${totalPending} solicitação(ões) aguardando aprovação.`,
      });
    }

    return list;
  }, [entries, hireDate, pendingVacation, pendingAdjustments, pendingCompensation, jornadaAlerts]);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Notificações" />
      {notices.length === 0 ? (
        <EmptyState
          glyph="🔔"
          title="Tudo em dia"
          description="Nenhum aviso no momento."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notices.map((notice) => (
            <View key={notice.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons
                name={notice.icon}
                size={22}
                color={notice.tone === "accent" ? theme.accent : theme.secondary}
              />
              <View style={styles.rowContent}>
                <ThemedText type="smallBold">{notice.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {notice.description}
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
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
});
