import { Pressable, StyleSheet, type GestureResponderEvent } from "react-native";

import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

type ThemedButtonProps = {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "accent" | "secondary";
};

export function ThemedButton({ title, onPress, variant = "accent" }: ThemedButtonProps) {
  const theme = useTheme();
  const backgroundColor = variant === "accent" ? theme.accent : theme.secondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <ThemedText type="smallBold" style={[styles.label, { color: theme.onAccent }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
  },
});
