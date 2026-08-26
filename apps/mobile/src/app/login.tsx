import { ImageBackground, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleSignIn() {
    // TODO: drive the OIDC flow with expo-auth-session and store the
    // returned JWT in expo-secure-store once the auth/SSO backend
    // (docs/superpowers/plans/2026-08-24-auth-sso-backend.md) is wired up.
    // Until then, pressing this just takes you straight to the app.
    router.replace("/(tabs)");
  }

  return (
    <ImageBackground
      source={require("@/assets/images/brand/login-background.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="default" style={styles.description}>
          Entre com sua conta corporativa para continuar.
        </ThemedText>
        <ThemedButton title="Entrar com SSO" onPress={handleSignIn} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "flex-end",
  },
  footer: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  description: {
    textAlign: "center",
    color: "#ffffff",
  },
});
