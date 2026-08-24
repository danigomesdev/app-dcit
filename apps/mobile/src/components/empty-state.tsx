import { StyleSheet } from "react-native";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { Spacing } from "@/constants/theme";

type EmptyStateProps = {
  glyph: string;
  title: string;
  description: string;
};

export function EmptyState({ glyph, title, description }: EmptyStateProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.glyph}>{glyph}</ThemedText>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
        {description}
      </ThemedText>
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
  glyph: {
    fontSize: 40,
  },
  description: {
    textAlign: "center",
  },
});
