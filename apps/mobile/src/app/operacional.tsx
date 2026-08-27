import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { formatElapsed } from "@/lib/operacional";
import {
  createDeslocamento,
  fetchDeslocamentos,
  fetchEscala,
  fetchSobreavisoStatus,
  toggleSobreaviso as toggleSobreavisoRequest,
  type DeslocamentoRecord,
  type EscalaShift,
} from "@/lib/operacional-api";
import { getSessionToken } from "@/lib/session";

const DAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// Explicit America/Sao_Paulo, not the device's ambient timezone and not
// UTC — deciding *which week is "now"* must follow the company's actual
// timezone (this app is built for a single Brazilian company throughout),
// or a colaborador checking the schedule late Sunday evening would see
// next week's roster while it's still Sunday locally. Formatting of
// already-known date-only values from the API stays UTC-only (unaffected
// by this — see the `.slice(0, 10)` comparisons below), only the "what is
// today" seed changes here.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function currentWeekDates(): string[] {
  const date = new Date(`${todaySaoPauloDateOnly()}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(date);
    current.setUTCDate(current.getUTCDate() + i);
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

export default function OperacionalScreen() {
  const theme = useTheme();
  const [sobreavisoActive, setSobreavisoActive] = useState(false);
  const [sobreavisoStartedAt, setSobreavisoStartedAt] = useState<string | null>(null);
  const [deslocamentoActive, setDeslocamentoActive] = useState(false);
  const [deslocamentoStartedAt, setDeslocamentoStartedAt] = useState<string | null>(null);
  const [deslocamentos, setDeslocamentos] = useState<DeslocamentoRecord[]>([]);
  const [escala, setEscala] = useState<EscalaShift[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const weekDates = currentWeekDates();
        const [status, records, shifts] = await Promise.all([
          fetchSobreavisoStatus(token),
          fetchDeslocamentos(token),
          fetchEscala(token, weekDates[0], weekDates[6]),
        ]);
        if (cancelled) return;
        if (status) {
          setSobreavisoActive(status.active);
          setSobreavisoStartedAt(status.startedAt);
        }
        if (records) setDeslocamentos(records);
        if (shifts) setEscala(shifts);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleToggleSobreaviso() {
    const token = await getSessionToken();
    if (!token) return;
    const result = await toggleSobreavisoRequest(token);
    if (!result) return;
    setSobreavisoActive(result.active);
    setSobreavisoStartedAt(result.startedAt);
  }

  async function handleToggleDeslocamento() {
    if (deslocamentoActive && deslocamentoStartedAt) {
      const token = await getSessionToken();
      const endedAt = new Date().toISOString();
      setDeslocamentoActive(false);
      setDeslocamentoStartedAt(null);
      if (!token) return;
      const created = await createDeslocamento(token, deslocamentoStartedAt, endedAt);
      if (created) setDeslocamentos((current) => [created, ...current]);
    } else {
      setDeslocamentoActive(true);
      setDeslocamentoStartedAt(new Date().toISOString());
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Operacional / TI" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">Escala de plantão desta semana</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {currentWeekDates().map((date, index) => {
            const dayShifts = escala.filter((shift) => shift.date.slice(0, 10) === date);
            return (
              <View key={date} style={styles.shiftRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.shiftDay}>
                  {DAY_LABELS[index]}
                </ThemedText>
                <View style={styles.shiftPeople}>
                  {dayShifts.length > 0 ? (
                    dayShifts.map((shift) => (
                      <ThemedText key={shift.id} type="smallBold">
                        {shift.label}: {shift.userName}
                      </ThemedText>
                    ))
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      —
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}
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
            onPress={handleToggleSobreaviso}
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
            onPress={handleToggleDeslocamento}
          />
        </View>

        {deslocamentos.length > 0 ? (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Deslocamentos recentes
            </ThemedText>
            {deslocamentos.map((record) => (
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
  shiftPeople: {
    alignItems: "flex-end",
    gap: 2,
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
