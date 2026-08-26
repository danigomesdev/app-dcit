import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Voltar"
        style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
      >
        <Ionicons name="chevron-back" size={20} color={theme.text} />
      </Pressable>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
});
