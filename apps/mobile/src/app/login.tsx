import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
import { useNotificationContext } from "@/context/notification-context";

export default function LoginScreen() {
  const router = useRouter();
  const { refresh: refreshNotifications } = useNotificationContext();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
          void refreshNotifications();
          router.replace("/(tabs)");
          return;
        }
        setCheckingSession(false);
      });
      return () => {
        cancelled = true;
      };
    }, [router, refreshNotifications]),
  );

  // SSO stays fully working in code — just without a UI entry point
  // (decided in conversation: email/senha is now the primary login,
  // SSO is parked, not removed, so it's easy to bring back).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept, not wired to a button
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
    void refreshNotifications();
    router.replace("/(tabs)");
  }

  async function handlePasswordLogin() {
    if (!email.trim() || !password || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/password-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, origin: "mobile" }),
      });
      if (!response.ok) {
        setError("Email ou senha incorretos.");
        return;
      }
      const data = (await response.json()) as { token: string };
      await saveSessionToken(data.token);
      registerForPushNotifications(data.token);
      void refreshNotifications();
      router.replace("/(tabs)");
    } catch {
      setError("Não foi possível entrar. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
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
                  source={require("@/assets/images/brand/sgp-icon.png")}
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
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Senha"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              secureTextEntry
              style={styles.input}
            />
            <ThemedButton title="Entrar" onPress={handlePasswordLogin} />
            <Pressable onPress={() => router.push("/esqueci-senha")}>
              <ThemedText type="small" style={styles.link}>
                Esqueci minha senha
              </ThemedText>
            </Pressable>
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  link: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.7)",
    textDecorationLine: "underline",
  },
  error: {
    textAlign: "center",
    color: "#F2531D",
  },
});
