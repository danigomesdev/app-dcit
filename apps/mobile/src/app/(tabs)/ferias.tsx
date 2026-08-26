import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, type DateData } from "react-native-calendars";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { TabBackground } from "@/components/tab-background";
import { usePonto, type VacationStatus } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  VACATION_HISTORY,
  AVAILABLE_DAYS,
  currentVacationCycle,
  dateKey,
  daysBetweenInclusive,
  daysUntil,
  formatDate,
} from "@/lib/ferias";

const STATUS_LABEL: Record<VacationStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const VENCIMENTO_ALERT_THRESHOLD_DAYS = 90;

export default function FeriasScreen() {
  const theme = useTheme();
  const { vacationRequests, addVacationRequest } = usePonto();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const cycle = useMemo(() => currentVacationCycle(), []);
  const daysToVencimento = daysUntil(cycle.vencimento);
  const vencimentoIsNear = daysToVencimento <= VENCIMENTO_ALERT_THRESHOLD_DAYS;

  const statusColor: Record<VacationStatus, string> = {
    pendente: theme.secondary,
    aprovado: theme.success,
    recusado: theme.accent,
  };

  const markedDates = useMemo(() => {
    if (!rangeStart) return {};
    if (!rangeEnd) {
      return { [rangeStart]: { startingDay: true, endingDay: true, color: theme.secondary, textColor: theme.onAccent } };
    }
    const marks: Record<string, { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }> = {};
    const cursor = new Date(rangeStart);
    const end = new Date(rangeEnd);
    while (dateKey(cursor) <= dateKey(end)) {
      const key = dateKey(cursor);
      marks[key] = {
        startingDay: key === rangeStart,
        endingDay: key === rangeEnd,
        color: theme.secondary,
        textColor: theme.onAccent,
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return marks;
  }, [rangeStart, rangeEnd, theme.secondary, theme.onAccent]);

  function handleDayPress(day: DateData) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day.dateString);
      setRangeEnd(null);
      return;
    }
    if (day.dateString < rangeStart) {
      setRangeStart(day.dateString);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(day.dateString);
  }

  function handleConfirmRequest() {
    if (!rangeStart || !rangeEnd) return;
    const days = daysBetweenInclusive(new Date(rangeStart), new Date(rangeEnd));
    addVacationRequest(rangeStart, rangeEnd, days);
    setPickerOpen(false);
    setRangeStart(null);
    setRangeEnd(null);
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Férias
        </ThemedText>

        <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="title" style={styles.balanceValue}>
            {AVAILABLE_DAYS} dias disponíveis
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Período aquisitivo: {formatDate(cycle.aquisitivoInicio)} — {formatDate(cycle.aquisitivoFim)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vencem em {formatDate(cycle.vencimento)}
          </ThemedText>
        </View>

        {vencimentoIsNear ? (
          <View style={[styles.alertBanner, { backgroundColor: theme.accent }]}>
            <Ionicons name="warning-outline" size={20} color={theme.onAccent} />
            <ThemedText type="small" style={{ color: theme.onAccent, flex: 1 }}>
              Suas férias vencem em {daysToVencimento} dias. Agende antes do prazo para evitar o
              pagamento em dobro.
            </ThemedText>
          </View>
        ) : null}

        <ThemedButton title="Solicitar Férias" onPress={() => setPickerOpen(true)} />

        <View style={styles.requestsSection}>
          <ThemedText type="smallBold">Suas solicitações</ThemedText>
          {vacationRequests
            .slice()
            .reverse()
            .map((request) => (
              <View
                key={request.id}
                style={[styles.requestRow, { backgroundColor: theme.backgroundElement }]}
              >
                <View style={styles.requestInfo}>
                  <ThemedText type="small">
                    {formatDate(new Date(request.startDate))} — {formatDate(new Date(request.endDate))}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {request.days} dia(s)
                  </ThemedText>
                </View>
                <View
                  style={[styles.statusBadge, { backgroundColor: statusColor[request.status] }]}
                >
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    {STATUS_LABEL[request.status]}
                  </ThemedText>
                </View>
              </View>
            ))}
        </View>

        <View style={styles.historySection}>
          <ThemedText type="smallBold">Histórico de férias</ThemedText>
          {VACATION_HISTORY.slice()
            .reverse()
            .map((entry) => (
              <View
                key={entry.year}
                style={[styles.historyRow, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText type="smallBold">{entry.year}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(entry.startDate)} — {formatDate(entry.endDate)} · {entry.daysTaken} dias
                </ThemedText>
              </View>
            ))}
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.pickerCard, { backgroundColor: theme.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText type="smallBold" style={styles.pickerTitle}>
              Escolha o período
            </ThemedText>
            <Calendar
              testID="vacation-calendar"
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDayPress}
              minDate={dateKey(new Date())}
              theme={{
                calendarBackground: theme.backgroundElement,
                dayTextColor: theme.text,
                monthTextColor: theme.text,
                textDisabledColor: theme.textSecondary,
                arrowColor: theme.secondary,
                todayTextColor: theme.secondary,
              }}
            />
            <ThemedButton
              title={
                rangeStart && rangeEnd
                  ? `Confirmar (${daysBetweenInclusive(new Date(rangeStart), new Date(rangeEnd))} dias)`
                  : "Selecione a data de início e fim"
              }
              onPress={handleConfirmRequest}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  balanceCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  balanceValue: {
    fontSize: 28,
    lineHeight: 34,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
  },
  requestsSection: {
    gap: Spacing.two,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: Spacing.three,
  },
  requestInfo: {
    gap: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  historySection: {
    gap: Spacing.two,
  },
  historyRow: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  pickerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pickerTitle: {
    fontSize: 16,
  },
});
