import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { clearSessionToken, getSessionToken } from "@/lib/session";

const ROLE_LABEL: Record<SessionClaims["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export default function PerfilScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [claims, setClaims] = useState<SessionClaims | null>(null);

  useEffect(() => {
    getSessionToken().then((token) => {
      if (token) setClaims(decodeSessionToken(token));
    });
  }, []);

  async function handleLogout() {
    await clearSessionToken();
    router.replace("/login");
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Perfil" />
      <View style={styles.content}>
        <View style={[styles.identityCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.avatar, { backgroundColor: theme.background }]}>
            <Ionicons name="person-outline" size={32} color={theme.secondary} />
          </View>
          <ThemedText type="subtitle" style={styles.name}>
            {claims?.name ?? "Colaborador"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {claims ? ROLE_LABEL[claims.role] : "—"}
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
          <MenuRow
            icon="rocket-outline"
            label="Boas-vindas / Onboarding"
            onPress={() => router.push("/onboarding")}
          />
          <MenuRow
            icon="gift-outline"
            label="Benefícios e clube de vantagens"
            onPress={() => router.push("/beneficios")}
          />
          <MenuRow
            icon="construct-outline"
            label="Operacional / TI"
            onPress={() => router.push("/operacional")}
            last={claims?.role === "colaborador" || !claims}
          />
          {claims && claims.role !== "colaborador" ? (
            <MenuRow
              icon="people-outline"
              label="Atestados da equipe"
              onPress={() => router.push("/atestados-equipe")}
              last
            />
          ) : null}
        </View>

        <Pressable
          style={[styles.logoutButton, { backgroundColor: theme.backgroundElement }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.accent} />
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Sair da conta
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, !last && styles.menuRowDivider, !last && { borderColor: theme.background }]}
    >
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" style={styles.menuLabel}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  identityCard: {
    alignItems: "center",
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.two,
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
  },
  section: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuRowDivider: {
    borderBottomWidth: 1,
  },
  menuLabel: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
});
