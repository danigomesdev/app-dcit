import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { getSessionToken } from "@/lib/session";
import { submitAdjustmentRequest } from "@/lib/solicitacoes-api";

export default function AjustarScreen() {
  const theme = useTheme();
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      return;
    }
    const token = await getSessionToken();
    const result = token ? await submitAdjustmentRequest(token, { reason: reason.trim() }) : null;
    if (result) {
      setReason("");
      setSent(true);
      setError(false);
    } else {
      setError(true);
      setSent(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Ajustar meu ponto" />
      <View style={styles.content}>
        <ThemedText type="smallBold">O que você precisa ajustar?</ThemedText>
        <TextInput
          value={reason}
          onChangeText={(text) => {
            setReason(text);
            setSent(false);
            setError(false);
          }}
          placeholder="Ex: esqueci de bater o ponto de saída às 18h"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.input,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />
        <ThemedButton title="Enviar solicitação" onPress={handleSubmit} />
        {sent ? (
          <ThemedText type="small" themeColor="secondary">
            Solicitação enviada — acompanhe em Solicitações de ajustes.
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="small" style={styles.error}>
            Não foi possível enviar a solicitação. Tente novamente.
          </ThemedText>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderRadius: 14,
    padding: Spacing.three,
    minHeight: 96,
    textAlignVertical: "top",
    fontSize: 16,
  },
  error: {
    color: "#F2531D",
  },
});
