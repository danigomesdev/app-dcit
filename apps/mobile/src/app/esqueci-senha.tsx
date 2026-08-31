import { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { API_URL } from "@/constants/api";
import { Spacing } from "@/constants/theme";

export default function EsqueciSenhaScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestCode() {
    if (!identifier.trim() || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!response.ok) {
        setError("Não foi possível processar o pedido.");
        return;
      }
      const data = (await response.json()) as { devCode?: string };
      setDevCode(data.devCode ?? null);
      setRequested(true);
    } catch {
      setError("Não foi possível entrar. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!code.trim() || newPassword.length < 8 || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      if (!response.ok) {
        setError("Código inválido ou expirado.");
        return;
      }
      setSuccess(true);
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
      <View style={styles.footer}>
        <ThemedText type="smallBold" style={styles.title}>
          Esqueci minha senha
        </ThemedText>

        {success ? (
          <>
            <ThemedText type="default" style={styles.description}>
              Senha redefinida com sucesso.
            </ThemedText>
            <ThemedButton title="Voltar ao login" onPress={() => router.replace("/login")} />
          </>
        ) : !requested ? (
          <>
            <ThemedText type="default" style={styles.description}>
              Informe seu email ou telefone cadastrado para receber um código de redefinição.
            </ThemedText>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Email ou telefone"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <ThemedButton title="Enviar código" onPress={handleRequestCode} />
            <Pressable onPress={() => router.back()}>
              <ThemedText type="small" style={styles.link}>
                Voltar ao login
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            {devCode ? (
              <ThemedText type="small" style={styles.devCode}>
                Modo de desenvolvimento — em produção isso chegaria por email/SMS. Código:{" "}
                {devCode}
              </ThemedText>
            ) : (
              <ThemedText type="default" style={styles.description}>
                Se essa conta existir, um código foi gerado.
              </ThemedText>
            )}
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Código de 6 dígitos"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nova senha"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              secureTextEntry
              style={styles.input}
            />
            <ThemedButton title="Redefinir senha" onPress={handleResetPassword} />
          </>
        )}
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
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: "center",
    color: "#ffffff",
    fontSize: 18,
  },
  description: {
    textAlign: "center",
    color: "#ffffff",
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
  devCode: {
    color: "#ffe9a8",
    backgroundColor: "rgba(180, 140, 40, 0.2)",
    borderRadius: 8,
    padding: Spacing.two,
  },
  error: {
    textAlign: "center",
    color: "#F2531D",
  },
});
