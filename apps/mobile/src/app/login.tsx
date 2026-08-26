import { useState } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { API_URL } from "@/constants/api";
import { Spacing } from "@/constants/theme";
import { saveSessionToken } from "@/lib/session";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    // In Expo Go this resolves to an exp:// URL Expo Go itself knows how to
    // route back into the running app; a real build would get its own
    // "mobile://" scheme instead. Either way, the backend needs this exact
    // value to redirect to once the OIDC exchange finishes server-side.
    const redirectUri = makeRedirectUri({ path: "auth-callback" });
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_URL}/auth/login?origin=mobile&redirectUri=${encodeURIComponent(redirectUri)}`,
      redirectUri,
    );

    if (result.type !== "success" || !result.url) {
      return;
    }

    const token = new URL(result.url).searchParams.get("token");
    if (!token) {
      setError("Não foi possível concluir o login.");
      return;
    }

    await saveSessionToken(token);
    router.replace("/(tabs)");
  }

  return (
    <ImageBackground
      source={require("@/assets/images/brand/login-background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="default" style={styles.description}>
          Entre com sua conta corporativa para continuar.
        </ThemedText>
        <ThemedButton title="Entrar com SSO" onPress={handleSignIn} />
        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
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
  error: {
    textAlign: "center",
    color: "#F2531D",
  },
});
