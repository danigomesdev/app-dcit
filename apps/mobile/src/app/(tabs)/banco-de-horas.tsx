import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { TabBackground } from "@/components/tab-background";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  buildDailyRecords,
  cumulativeBalance,
  endOfMonth,
  estimateDsrMinutes,
  estimateOvertimeValueBRL,
  formatBRL,
  formatSignedMinutes,
  startOfMonth,
  type DailyRecord,
} from "@/lib/banco-de-horas";

type Period = "current" | "previous" | "last3";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "current", label: "Mês atual" },
  { key: "previous", label: "Mês passado" },
  { key: "last3", label: "Últimos 3 meses" },
];

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

export default function BancoDeHorasScreen() {
  const theme = useTheme();
  const { entries, compensationRequests, addCompensationRequest } = usePonto();
  const [period, setPeriod] = useState<Period>("current");
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const chartRecords = useMemo(
    () => buildDailyRecords(entries, daysAgo(29), new Date()),
    [entries],
  );
  // "Saldo atual" is the accumulated balance over a 90-day rolling window —
  // there's no real multi-year history to sum yet (seeded data only goes
  // back so far), so this is the honest boundary of what's being tracked.
  const overallRecords = useMemo(
    () => buildDailyRecords(entries, daysAgo(89), new Date()),
    [entries],
  );
  const balance = cumulativeBalance(overallRecords);

  const periodRecords = useMemo(() => {
    const today = new Date();
    if (period === "current") return buildDailyRecords(entries, startOfMonth(today), today);
    if (period === "previous")
      return buildDailyRecords(entries, startOfMonth(today, 1), endOfMonth(today, 1));
    return buildDailyRecords(entries, daysAgo(89), today);
  }, [period, entries]);

  const dsrMinutes = estimateDsrMinutes(periodRecords);
  const overtimeValue = estimateOvertimeValueBRL(periodRecords);
  const balanceColor = balance >= 0 ? theme.success : theme.accent;

  function handleSubmitCompensation() {
    if (!reason.trim()) return;
    addCompensationRequest(reason.trim());
    setReason("");
    setSent(true);
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Banco de Horas
        </ThemedText>

        <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Saldo atual
          </ThemedText>
          <ThemedText type="title" style={[styles.balanceValue, { color: balanceColor }]}>
            {formatSignedMinutes(balance)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Acumulado nos últimos 90 dias
          </ThemedText>
        </View>

        <View style={styles.chartSection}>
          <ThemedText type="smallBold">Evolução (últimos 30 dias)</ThemedText>
          <MiniChart records={chartRecords} />
        </View>

        <View style={styles.periodFilter}>
          {PERIOD_OPTIONS.map((option) => {
            const active = option.key === period;
            return (
              <Pressable
                key={option.key}
                onPress={() => setPeriod(option.key)}
                style={[
                  styles.periodOption,
                  {
                    backgroundColor: active ? theme.secondary : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={active ? { color: theme.onAccent } : undefined}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dailyList}>
          <View style={styles.dailyHeaderRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.colDate}>
              Dia
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
              Previstas
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
              Trabalhadas
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
              Diferença
            </ThemedText>
          </View>
          {periodRecords
            .slice()
            .reverse()
            .map((record) => (
              <DailyRow key={record.dateKey} record={record} />
            ))}
        </View>

        <View style={[styles.insightsRow]}>
          <View style={[styles.insightCard, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.secondary} />
            <ThemedText type="small" themeColor="textSecondary">
              DSR estimado
            </ThemedText>
            <ThemedText type="smallBold">{formatSignedMinutes(dsrMinutes)}</ThemedText>
          </View>
          <View style={[styles.insightCard, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="cash-outline" size={20} color={theme.secondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Extras em R$
            </ThemedText>
            <ThemedText type="smallBold">{formatBRL(overtimeValue)}</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          Estimativas ilustrativas com jornada padrão de 8h/dia e valor-hora fixo — não
          substituem o cálculo oficial da folha.
        </ThemedText>

        <ThemedButton
          title={formOpen ? "Cancelar" : "Solicitar compensação de banco de horas"}
          variant="secondary"
          onPress={() => {
            setFormOpen((open) => !open);
            setSent(false);
          }}
        />

        {formOpen ? (
          <View style={[styles.form, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                setSent(false);
              }}
              placeholder="Ex: compensar 4h do saldo positivo na sexta-feira"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            />
            <ThemedButton title="Enviar solicitação" onPress={handleSubmitCompensation} />
            {sent ? (
              <ThemedText type="small" themeColor="secondary">
                Solicitação enviada — status: pendente.
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {compensationRequests.length > 0 ? (
          <View style={styles.requestsList}>
            <ThemedText type="smallBold">Solicitações de compensação</ThemedText>
            {compensationRequests
              .slice()
              .reverse()
              .map((request) => (
                <View
                  key={request.id}
                  style={[styles.requestRow, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText type="small">{request.reason}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Pendente
                  </ThemedText>
                </View>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </TabBackground>
  );
}

function MiniChart({ records }: { records: DailyRecord[] }) {
  const theme = useTheme();
  const scale = Math.max(60, ...records.map((r) => Math.abs(r.diffMinutes)));

  return (
    <View style={styles.chart}>
      {records.map((record) => {
        const height = Math.max(2, (Math.abs(record.diffMinutes) / scale) * 36);
        const positive = record.diffMinutes >= 0;
        return (
          <View key={record.dateKey} style={styles.chartBarColumn}>
            {positive ? <View style={styles.chartBarSpacer} /> : null}
            <View
              style={[
                styles.chartBar,
                {
                  height,
                  backgroundColor: positive ? theme.success : theme.accent,
                },
              ]}
            />
            {!positive ? <View style={styles.chartBarSpacer} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function DailyRow({ record }: { record: DailyRecord }) {
  const theme = useTheme();
  return (
    <View style={styles.dailyRow}>
      <ThemedText type="small" style={styles.colDate}>
        {record.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        {record.isToday ? " (hoje)" : ""}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
        {Math.round(record.expectedMinutes / 60)}h
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
        {(record.workedMinutes / 60).toFixed(1)}h
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={[
          styles.colValue,
          { color: record.diffMinutes >= 0 ? theme.success : theme.accent },
        ]}
      >
        {formatSignedMinutes(record.diffMinutes)}
      </ThemedText>
    </View>
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
    alignItems: "center",
    gap: Spacing.one,
  },
  balanceValue: {
    fontSize: 40,
    lineHeight: 46,
  },
  chartSection: {
    gap: Spacing.two,
  },
  chart: {
    flexDirection: "row",
    alignItems: "center",
    height: 80,
    gap: 3,
  },
  chartBarColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  chartBarSpacer: {
    flex: 1,
  },
  chartBar: {
    borderRadius: 2,
    minHeight: 2,
  },
  periodFilter: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  periodOption: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  dailyList: {
    gap: Spacing.one,
  },
  dailyHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.two,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  colDate: {
    flex: 1.2,
  },
  colValue: {
    flex: 1,
    textAlign: "right",
  },
  insightsRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  insightCard: {
    flex: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  disclaimer: {
    marginTop: -Spacing.two,
  },
  form: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: 12,
    padding: Spacing.three,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 16,
  },
  requestsList: {
    gap: Spacing.two,
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: Spacing.three,
  },
});
