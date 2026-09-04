import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeContext } from "@/context/theme-context";
import { useTheme } from "@/hooks/use-theme";
import { Elevation } from "@/constants/theme";

export function ThemeToggle() {
  const theme = useTheme();
  const { toggleTheme } = useThemeContext();

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityLabel="Alterar tema"
      style={[styles.headerIcon, { backgroundColor: theme.backgroundElement }, Elevation.card]}
    >
      <Ionicons name="contrast-outline" size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
