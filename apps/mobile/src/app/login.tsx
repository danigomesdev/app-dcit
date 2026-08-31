import { useCallback, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { API_URL } from "@/constants/api";
import { Spacing } from "@/constants/theme";
import { getSessionToken, saveSessionToken } from "@/lib/session";
import { registerForPushNotifications } from "@/lib/push";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // useFocusEffect (not a plain mount effect) so this only runs — and only
  // redirects — while login is the screen actually being shown. A plain
  // useEffect fires once on mount regardless of focus, since
  // unstable_settings.initialRouteName keeps login mounted in the
  // background at the base of the stack even after navigating away, and
  // its redirect would otherwise race with (and clobber) whatever the app
  // navigates to next.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setCheckingSession(true);
      getSessionToken().then((token) => {
        if (cancelled) return;
        if (token) {
          router.replace("/(tabs)");
          return;
        }
        setCheckingSession(false);
      });
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

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
    registerForPushNotifications(token);
    router.replace("/(tabs)");
  }

  return (
    <ImageBackground
      source={require("@/assets/images/brand/login-background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        {checkingSession ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <View style={styles.brand}>
              <View style={styles.brandIcon}>
                <Image
                  source={require("@/assets/images/brand/dcit-logo.png")}
                  style={styles.brandIconImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandText}>
                <ThemedText type="smallBold" style={styles.brandTitle}>
                  SGP
                </ThemedText>
                <ThemedText type="small" style={styles.brandSubtitle}>
                  Sistema de Gestão de Pessoas
                </ThemedText>
              </View>
            </View>
            <ThemedText type="default" style={styles.description}>
              Entre com sua conta corporativa para continuar.
            </ThemedText>
            <ThemedButton title="Entrar com SSO" onPress={handleSignIn} />
            {error ? (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
          </>
        )}
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
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandIconImage: {
    width: "100%",
    height: "100%",
    padding: 4,
  },
  brandText: {
    flex: 1,
    gap: 1,
  },
  brandTitle: {
    color: "#ffffff",
  },
  brandSubtitle: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.72)",
  },
  error: {
    textAlign: "center",
    color: "#F2531D",
  },
});
