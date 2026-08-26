import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { usePonto } from "@/context/ponto-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function AjustarScreen() {
  const { addAdjustmentRequest } = usePonto();
  const theme = useTheme();
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit() {
    if (!reason.trim()) {
      return;
    }
    addAdjustmentRequest(reason.trim());
    setReason("");
    setSent(true);
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
});
