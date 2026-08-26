import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();

  function handleSignIn() {
    // TODO: drive the OIDC flow with expo-auth-session and store the
    // returned JWT in expo-secure-store once the auth/SSO backend
    // (docs/superpowers/plans/2026-08-24-auth-sso-backend.md) is wired up.
    // Until then, pressing this just takes you straight to the app.
    router.replace("/(tabs)");
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.accent }]} />
        <ThemedText type="title" themeColor="primary" style={styles.title}>
          Ponto DCIT
        </ThemedText>
      </View>
      <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
        Entre com sua conta corporativa para acessar o sistema.
      </ThemedText>
      <View style={styles.action}>
        <ThemedButton title="Entrar com SSO" onPress={handleSignIn} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  brand: {
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.five,
  },
  action: {
    alignSelf: "stretch",
  },
});
