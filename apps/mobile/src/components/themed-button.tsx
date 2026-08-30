import { useState } from "react";
import { Animated, Pressable, StyleSheet, type GestureResponderEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing } from "@/constants/theme";

type ThemedButtonProps = {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "accent" | "secondary";
};

export function ThemedButton({ title, onPress, variant = "accent" }: ThemedButtonProps) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(1));

  const gradientColors: [string, string] =
    variant === "accent" ? [theme.accent, theme.secondary] : [theme.secondary, theme.primary];
  const shadowColor = variant === "accent" ? theme.accent : theme.secondary;

  function animateTo(toValue: number) {
    Animated.timing(scale, {
      toValue,
      duration: toValue < 1 ? 100 : 150,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { shadowColor }]}
        >
          <ThemedText type="smallBold" style={[styles.label, { color: theme.onAccent }]}>
            {title}
          </ThemedText>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  label: {
    fontSize: 16,
  },
});
