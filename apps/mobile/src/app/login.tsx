import { useState } from "react";
import { Button, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSignIn() {
    // TODO: drive the OIDC flow with expo-auth-session and store the
    // returned JWT in expo-secure-store once the auth/SSO backend
    // (docs/superpowers/plans/2026-08-24-auth-sso-backend.md) is merged.
    setMessage("O login com SSO ainda não está conectado.");
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Ponto DCIT</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
        Entre com sua conta corporativa para acessar o sistema.
      </ThemedText>
      <Button title="Entrar com SSO" onPress={handleSignIn} />
      {message ? <ThemedText style={styles.description}>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  description: {
    textAlign: "center",
  },
});
