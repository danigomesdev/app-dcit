import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColorScheme } from "@/hooks/use-color-scheme";

export type ThemeName = "light" | "dark";

const STORAGE_KEY = "theme-override";

type ThemeContextValue = {
  theme: ThemeName;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeName | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") {
        setOverride(stored);
      }
    });
  }, []);

  const theme: ThemeName = override ?? (systemScheme === "dark" ? "dark" : "light");

  const toggleTheme = useCallback(() => {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    setOverride(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useThemeContext must be used within an AppThemeProvider");
  }
  return value;
}

// Used by useTheme() (constants/theme colors) so components and their tests
// keep working with the plain OS color scheme even when rendered outside an
// AppThemeProvider (e.g. component tests that don't wrap every provider).
export function useOptionalThemeContext() {
  return useContext(ThemeContext);
}
