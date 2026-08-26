import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import type { ComponentProps } from "react";
import type { TimeEntryInput } from "@ponto-dcit/shared-types";

import { PunchConfirmationModal } from "@/components/punch-confirmation-modal";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { TabBackground } from "@/components/tab-background";
import { API_URL } from "@/constants/api";
import { formatMinutes, summarizeDay, usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { getSessionToken } from "@/lib/session";

type IconName = ComponentProps<typeof Ionicons>["name"];

type QuickActionItem = {
  id: string;
  icon: IconName;
  label: string;
  href: Href;
};

const QUICK_ACTIONS: QuickActionItem[] = [
  { id: "historico", icon: "receipt-outline", label: "Histórico de pontos", href: "/historico" },
  { id: "folha", icon: "document-text-outline", label: "Folha de ponto", href: "/folha" },
  { id: "ajustar", icon: "briefcase-outline", label: "Ajustar meu ponto", href: "/ajustar" },
  {
    id: "solicitacoes",
    icon: "create-outline",
    label: "Solicitações de ajustes",
    href: "/solicitacoes",
  },
];

function HeaderIconButton({ icon }: { icon: IconName }) {
  const theme = useTheme();
  return (
    <View style={[styles.headerIcon, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={20} color={theme.text} />
    </View>
  );
}

function QuickAction({ icon, label, href }: QuickActionItem) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={[styles.quickAction, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: theme.background }]}>
        <Ionicons name={icon} size={20} color={theme.secondary} />
      </View>
      <ThemedText type="small" style={styles.quickActionLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { entries, addEntry } = usePonto();
  const [error, setError] = useState<string | null>(null);
  const [hoursVisible, setHoursVisible] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [confirmation, setConfirmation] = useState<Date | null>(null);

  useEffect(() => {
    getSessionToken().then((token) => {
      if (token) setClaims(decodeSessionToken(token));
    });
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((entry) => entry.clockedAt.slice(0, 10) === todayKey);
  const { workedMinutes, isOpen } = summarizeDay(todayEntries);
  const lastEntry = todayEntries[todayEntries.length - 1];
  const lastPunchTime = lastEntry
    ? new Date(lastEntry.clockedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  async function handlePress() {
    const token = await getSessionToken();
    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      router.replace("/login");
      return;
    }

    const now = new Date();
    const payload: TimeEntryInput = {
      userId: "demo-user",
      clockedAt: now.toISOString(),
    };

    try {
      const response = await fetch(`${API_URL}/time-entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setError(null);
        addEntry(now.toISOString());
        setClaims(decodeSessionToken(token));
        setConfirmation(now);
      } else {
        setError("Falha ao registrar ponto");
      }
    } catch {
      setError("Falha ao registrar ponto");
    }
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]} />
          <View style={styles.headerActions}>
            <HeaderIconButton icon="search-outline" />
            <HeaderIconButton icon="notifications-outline" />
            <HeaderIconButton icon="menu-outline" />
          </View>
        </View>

        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="person-outline" size={22} color={theme.secondary} />
          </View>
          <View style={styles.identityText}>
            <ThemedText type="smallBold">Olá, {claims?.name ?? "Colaborador"}</ThemedText>
            <View style={styles.locationInline}>
              <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {/* TODO: capture real GPS once expo-location is wired up (spec §5, non-blocking audit trail) */}
                Localização ainda não disponível
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Meu ponto
            </ThemedText>
            <Pressable onPress={() => setHoursVisible((visible) => !visible)}>
              <Ionicons
                name={hoursVisible ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>

          <ThemedButton title="Bater Ponto" onPress={handlePress} />

          <View style={[styles.row, { backgroundColor: theme.background }]}>
            <Ionicons name="time-outline" size={20} color={theme.secondary} />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">Último ponto</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Registrado às: {lastPunchTime ?? "--:--"}
              </ThemedText>
            </View>
            <Pressable
              style={styles.detailsToggle}
              onPress={() => setDetailsExpanded((expanded) => !expanded)}
            >
              <ThemedText type="smallBold" themeColor="secondary">
                Detalhes
              </ThemedText>
              <Ionicons
                name={detailsExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.secondary}
              />
            </Pressable>
          </View>
          {detailsExpanded ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.detailsText}>
              {todayEntries.length} registro(s) hoje.{" "}
              {isOpen ? "Ponto em aberto (aguardando saída)." : "Todos os pares fechados."}
            </ThemedText>
          ) : null}

          <View style={[styles.row, { backgroundColor: theme.background }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Total de horas trabalhadas hoje:
            </ThemedText>
            <ThemedText type="smallBold">
              {hoursVisible ? formatMinutes(workedMinutes) : "••••"}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Toque no ícone de olho para ver as horas trabalhadas.
          </ThemedText>

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.id} {...action} />
          ))}
        </View>
      </ScrollView>

      <PunchConfirmationModal
        visible={confirmation !== null}
        onClose={() => setConfirmation(null)}
        clockedAt={confirmation}
        claims={claims}
      />
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  locationInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    flexBasis: "47%",
    flexGrow: 1,
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.two,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailsText: {
    marginTop: -Spacing.two,
  },
  hint: {
    marginTop: -Spacing.two,
  },
  error: {
    color: "#F2531D",
  },
});
