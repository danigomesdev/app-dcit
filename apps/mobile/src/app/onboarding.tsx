import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

type OnboardingStep = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const STEPS: OnboardingStep[] = [
  {
    id: "contrato",
    icon: "document-text-outline",
    title: "Assinar o contrato",
    description: "Revise e assine seu contrato de trabalho digitalmente.",
  },
  {
    id: "documentos",
    icon: "cloud-upload-outline",
    title: "Enviar documentos",
    description: "RG, CPF, comprovante de residência e demais documentos admissionais.",
  },
  {
    id: "video",
    icon: "play-circle-outline",
    title: "Assistir ao vídeo de boas-vindas",
    description: "Conheça a cultura e os valores da DCIT Tecnologia.",
  },
  {
    id: "time",
    icon: "people-outline",
    title: "Conhecer o time",
    description: "Veja quem são as pessoas com quem você vai trabalhar.",
  },
  {
    id: "acessos",
    icon: "key-outline",
    title: "Configurar seus acessos",
    description: "E-mail corporativo, ferramentas internas e este app.",
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const progress = done.size / STEPS.length;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Boas-vindas" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="default" themeColor="textSecondary">
          Complete os passos abaixo antes do seu primeiro dia.
        </ThemedText>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.secondary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done.size} de {STEPS.length} concluídos
        </ThemedText>

        <View style={styles.list}>
          {STEPS.map((step) => {
            const checked = done.has(step.id);
            return (
              <Pressable
                key={step.id}
                onPress={() => toggle(step.id)}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}
              >
                <Ionicons
                  name={checked ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={checked ? theme.success : theme.textSecondary}
                />
                <View style={styles.rowContent}>
                  <ThemedText
                    type="smallBold"
                    style={checked ? styles.strikethrough : undefined}
                  >
                    {step.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {step.description}
                  </ThemedText>
                </View>
                <Ionicons name={step.icon} size={20} color={theme.secondary} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  list: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
});
