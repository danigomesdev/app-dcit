import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { TabBackground } from "@/components/tab-background";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Radius, Spacing } from "@/constants/theme";
import {
  fetchBancoDeHoras,
  type BancoDeHorasDay,
  type BancoDeHorasSummary,
} from "@/lib/banco-de-horas-api";
import {
  endOfMonth,
  formatBRL,
  formatSignedMinutes,
  startOfMonth,
} from "@/lib/banco-de-horas";
import { getSessionToken } from "@/lib/session";
import {
  fetchCompensationRequests,
  submitCompensationRequest,
  type CompensationRequestRecord,
} from "@/lib/solicitacoes-api";

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

// Local calendar-day string (not UTC) — matches this screen's existing
// convention (daysAgo/startOfMonth/endOfMonth all use local Date
// components), so the query window sent to the API lines up with what the
// period picker actually means on the device's clock.
function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parses a "YYYY-MM-DD" string as a local-time Date (not UTC midnight) so
// display formatting never shifts the day backward on devices west of UTC.
function parseDateOnly(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function BancoDeHorasScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("current");
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [compensationRequests, setCompensationRequests] = useState<CompensationRequestRecord[]>(
    [],
  );
  const [chartSummary, setChartSummary] = useState<BancoDeHorasSummary | null>(null);
  const [overallSummary, setOverallSummary] = useState<BancoDeHorasSummary | null>(null);
  const [periodSummary, setPeriodSummary] = useState<BancoDeHorasSummary | null>(null);

  const { periodStart, periodEnd } = useMemo(() => {
    const today = new Date();
    if (period === "current") return { periodStart: startOfMonth(today), periodEnd: today };
    if (period === "previous")
      return { periodStart: startOfMonth(today, 1), periodEnd: endOfMonth(today, 1) };
    return { periodStart: daysAgo(89), periodEnd: today };
  }, [period]);

  // Folded into one useFocusEffect (rather than a separate effect keyed on
  // [periodStart, periodEnd]) so both a screen refocus and a period-picker
  // change refetch the daily list/DSR/Extras together with the balance
  // card, instead of leaving the former stale on refocus. useFocusEffect
  // reruns its callback whenever the callback identity changes (via
  // useCallback's deps below) AND the screen is currently focused — which
  // also covers "period switch while already focused" the same way the
  // previous separate effect did.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const today = new Date();
        // fetchCompensationRequests is deliberately not folded into the
        // Promise.all below: it races against handleSubmitCompensation's
        // own POST-driven state update, and awaiting it alongside the
        // slower fetchBancoDeHoras calls (each with its own JSON-shape
        // validation) let it resolve after a just-submitted request had
        // already landed in state, silently overwriting it with the
        // (still-empty, pre-submission) server list. Fetching it on its
        // own promise chain keeps that race from being introduced here.
        fetchCompensationRequests(token).then((compReqs) => {
          if (!cancelled && compReqs) setCompensationRequests(compReqs);
        });
        const [chart, overall, periodData] = await Promise.all([
          fetchBancoDeHoras(token, toDateOnly(daysAgo(29)), toDateOnly(today)),
          fetchBancoDeHoras(token, toDateOnly(daysAgo(89)), toDateOnly(today)),
          fetchBancoDeHoras(token, toDateOnly(periodStart), toDateOnly(periodEnd)),
        ]);
        if (cancelled) return;
        setChartSummary(chart);
        setOverallSummary(overall);
        setPeriodSummary(periodData);
      });
      return () => {
        cancelled = true;
      };
    }, [periodStart, periodEnd]),
  );

  const chartDays = chartSummary?.days ?? [];
  const periodDays = periodSummary?.days ?? [];
  // overallSummary/periodSummary stay null until a fetch has actually
  // resolved successfully — that's distinct from a confirmed zero balance,
  // so the cards below render "—" while null instead of defaulting to 0
  // and looking identical to "you really have a zero balance."
  const balanceLoaded = overallSummary !== null;
  const balance = overallSummary?.balanceMinutes ?? 0;
  const periodLoaded = periodSummary !== null;
  const dsrMinutes = periodSummary?.dsrMinutes ?? 0;
  const overtimeValue = periodSummary?.overtimeValueBRL ?? null;
  const balanceColor = balanceLoaded ? (balance >= 0 ? theme.success : theme.accent) : theme.textSecondary;

  async function handleSubmitCompensation() {
    if (!reason.trim()) return;
    const token = await getSessionToken();
    const result = token
      ? await submitCompensationRequest(token, { reason: reason.trim() })
      : null;
    if (result) {
      setCompensationRequests((current) => [result, ...current]);
      setReason("");
      setSent(true);
      setError(false);
    } else {
      setError(true);
      setSent(false);
    }
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Banco de Horas
        </ThemedText>

        <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
          <ThemedText type="small" themeColor="textSecondary">
            Saldo atual
          </ThemedText>
          <ThemedText type="title" style={[styles.balanceValue, { color: balanceColor }]}>
            {balanceLoaded ? formatSignedMinutes(balance) : "—"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Acumulado nos últimos 90 dias
          </ThemedText>
        </View>

        <View style={styles.chartSection}>
          <ThemedText type="smallBold">Evolução (últimos 30 dias)</ThemedText>
          <MiniChart days={chartDays} />
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
          {periodDays
            .slice()
            .reverse()
            .map((day) => (
              <DailyRow key={day.date} day={day} />
            ))}
        </View>

        <View style={[styles.insightsRow]}>
          <View style={[styles.insightCard, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
            <Ionicons name="calendar-outline" size={20} color={theme.secondary} />
            <ThemedText type="small" themeColor="textSecondary">
              DSR estimado
            </ThemedText>
            <ThemedText type="smallBold">
              {periodLoaded ? formatSignedMinutes(dsrMinutes) : "—"}
            </ThemedText>
          </View>
          <View style={[styles.insightCard, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
            <Ionicons name="cash-outline" size={20} color={theme.secondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Extras em R$
            </ThemedText>
            <ThemedText type="smallBold">
              {overtimeValue === null ? "—" : formatBRL(overtimeValue)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          Cálculo baseado nos seus registros de ponto e nos parâmetros da sua convenção
          coletiva — não substitui o cálculo oficial da folha.
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
          <View style={[styles.form, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
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
            {error ? (
              <ThemedText type="small" style={styles.errorText}>
                Não foi possível enviar a solicitação. Tente novamente.
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {compensationRequests.length > 0 ? (
          <View style={styles.requestsList}>
            <ThemedText type="smallBold">Solicitações de compensação</ThemedText>
            {compensationRequests.map((request) => (
              <View
                key={request.id}
                style={[styles.requestRow, { backgroundColor: theme.backgroundElement }, Elevation.card]}
              >
                <ThemedText type="small">{request.reason}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {request.status === "pendente" ? "Pendente" : request.status}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </TabBackground>
  );
}

function MiniChart({ days }: { days: BancoDeHorasDay[] }) {
  const theme = useTheme();
  const scale = Math.max(60, ...days.map((d) => Math.abs(d.diffMinutes)));

  return (
    <View style={styles.chart}>
      {days.map((day) => {
        const height = Math.max(2, (Math.abs(day.diffMinutes) / scale) * 36);
        const positive = day.diffMinutes >= 0;
        return (
          <View key={day.date} style={styles.chartBarColumn}>
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

function DailyRow({ day }: { day: BancoDeHorasDay }) {
  const theme = useTheme();
  const isToday = day.date === toDateOnly(new Date());
  return (
    <View style={styles.dailyRow}>
      <ThemedText type="small" style={styles.colDate}>
        {parseDateOnly(day.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        {isToday ? " (hoje)" : ""}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
        {Math.round(day.expectedMinutes / 60)}h
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.colValue}>
        {(day.workedMinutes / 60).toFixed(1)}h
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={[
          styles.colValue,
          { color: day.diffMinutes >= 0 ? theme.success : theme.accent },
        ]}
      >
        {formatSignedMinutes(day.diffMinutes)}
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
    borderRadius: Radius.xl,
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
  errorText: {
    color: "#F2531D",
  },
});
