import { StyleSheet, View } from "react-native";

import { ThemedText } from "./themed-text";

import { Spacing } from "@/constants/theme";

type EmptyStateProps = {
  glyph: string;
  title: string;
  description: string;
};

// Transparent on purpose: every call site already sits inside a screen
// that paints its own background (a plain color or, on the tab screens,
// the branded TabBackground image) — an opaque background here would
// cover that up instead of layering on top of it.
export function EmptyState({ glyph, title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.glyph}>{glyph}</ThemedText>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
        {description}
      </ThemedText>
    </View>
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
