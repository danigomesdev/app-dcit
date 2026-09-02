import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PunchConfirmationModal } from "@/components/punch-confirmation-modal";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { TabBackground } from "@/components/tab-background";
import { formatMinutes, summarizeDay, usePonto } from "@/context/ponto-context";
import { useNotificationContext } from "@/context/notification-context";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Radius, Spacing } from "@/constants/theme";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { greetingForHour } from "@/lib/greeting";
import { captureCurrentAddress } from "@/lib/location";
import { cancelForgotPunchReminder, scheduleForgotPunchReminder } from "@/lib/reminders";
import { getSessionToken } from "@/lib/session";
import { fetchTimeEntries, submitTimeEntry } from "@/lib/time-entries-api";

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

function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  children,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.headerIcon, { backgroundColor: theme.backgroundElement }, Elevation.card]}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
      {children}
    </Pressable>
  );
}

function QuickAction({ icon, label, href }: QuickActionItem) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={[styles.quickAction, { backgroundColor: theme.backgroundElement }, Elevation.card]}
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
  const insets = useSafeAreaInsets();
  const { entries, addEntry, markEntrySynced, hydrateEntries } = usePonto();
  const { unreadCount } = useNotificationContext();
  const [error, setError] = useState<string | null>(null);
  const [hoursVisible, setHoursVisible] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [confirmation, setConfirmation] = useState<Date | null>(null);
  const [locationText, setLocationText] = useState<string | null>(null);
  const [addressExpanded, setAddressExpanded] = useState(false);

  useEffect(() => {
    getSessionToken().then(async (token) => {
      if (!token) return;
      setClaims(decodeSessionToken(token));
      const serverEntries = await fetchTimeEntries(token);
      if (serverEntries) hydrateEntries(serverEntries);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncPendingEntries() {
    const token = await getSessionToken();
    if (!token) return;
    const pending = entries.filter((entry) => entry.synced === false);
    for (const entry of pending) {
      const result = await submitTimeEntry(token, entry.clockedAt);
      if (result.ok) {
        markEntrySynced(entry.id);
      }
    }
  }

  // Offline mode (spec §4.5): a punch that fails because the device has no
  // connectivity is still recorded locally with its real capture-time
  // timestamp (see handlePress) rather than lost. This listener retries any
  // such pending entries the moment connectivity returns, so syncing is
  // automatic — never something the person has to remember to do.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected) return;
      syncPendingEntries();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  useEffect(() => {
    // Runs independently of the punch flow — a denied permission or a GPS
    // failure only affects this label, it never blocks Bater Ponto.
    captureCurrentAddress().then((address) => {
      setLocationText(address ?? "Localização não disponível");
    });
  }, []);

  const greeting = greetingForHour(new Date().getHours());
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((entry) => entry.clockedAt.slice(0, 10) === todayKey);
  const pendingSyncCount = entries.filter((entry) => entry.synced === false).length;
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

    // Captured on-device at the moment of the tap — this is what actually
    // gets recorded even if the request below fails and the punch has to
    // be queued for later sync, matching the spec's "timestamp local no
    // momento do toque" for offline punches.
    const now = new Date();
    const result = await submitTimeEntry(token, now.toISOString());

    if (result.ok) {
      setError(null);
      addEntry(now.toISOString(), true);
    } else if (result.reason === "network") {
      // Never blocks the button (spec §4.1) — record locally and let the
      // NetInfo listener above sync it automatically once back online.
      setError(null);
      addEntry(now.toISOString(), false);
    } else {
      setError("Falha ao registrar ponto");
      return;
    }

    setClaims(decodeSessionToken(token));
    setConfirmation(now);

    const willBeOpen = (todayEntries.length + 1) % 2 === 1;
    if (willBeOpen) {
      scheduleForgotPunchReminder();
    } else {
      cancelForgotPunchReminder();
    }
  }

  return (
    <TabBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <HeaderIconButton
              icon="search-outline"
              accessibilityLabel="Buscar"
              onPress={() => router.push("/busca")}
            />
            <HeaderIconButton
              icon="notifications-outline"
              accessibilityLabel="Notificações"
              onPress={() => router.push("/notificacoes")}
            >
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </HeaderIconButton>
          </View>
          <View style={styles.identity}>
            <Pressable
              accessibilityLabel="Abrir perfil"
              onPress={() => router.push("/perfil")}
              style={[styles.avatar, { backgroundColor: theme.backgroundElement }, Elevation.card]}
            >
              <Ionicons name="person-outline" size={24} color={theme.secondary} />
            </Pressable>
            <View style={styles.identityText}>
              <ThemedText
                type="subtitle"
                style={styles.greeting}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {greeting}, {claims?.name ?? "Colaborador"}
              </ThemedText>
              <Pressable
                style={styles.locationInline}
                onPress={() => setAddressExpanded((expanded) => !expanded)}
              >
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={addressExpanded ? undefined : 1}
                  ellipsizeMode="tail"
                  style={styles.locationText}
                >
                  {locationText ?? "Obtendo localização..."}
                </ThemedText>
                <Ionicons
                  name={addressExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }, Elevation.card]}>
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

          {pendingSyncCount > 0 ? (
            <View style={styles.syncBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={theme.accent} />
              <ThemedText type="small" style={{ color: theme.accent }}>
                {pendingSyncCount} ponto(s) registrado(s) offline — sincroniza automaticamente
                quando a conexão voltar.
              </ThemedText>
            </View>
          ) : null}

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
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: "row",
    alignSelf: "flex-end",
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
    alignItems: "flex-start",
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: 20,
    lineHeight: 26,
  },
  locationInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  locationText: {
    flex: 1,
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
    borderRadius: Radius.xl,
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
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
});
