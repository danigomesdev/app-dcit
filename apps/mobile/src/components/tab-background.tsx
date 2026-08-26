import { ImageBackground, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { useTheme } from "@/hooks/use-theme";

export function TabBackground({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <ImageBackground
      source={require("@/assets/images/brand/app-background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.scrim, { backgroundColor: theme.backgroundScrim }]}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scrim: {
    flex: 1,
  },
});
