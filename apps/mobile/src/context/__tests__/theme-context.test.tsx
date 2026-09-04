import { Pressable, Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppThemeProvider, useThemeContext } from "../theme-context";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(),
}));

import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

function ThemeConsumer() {
  const { theme, toggleTheme } = useThemeContext();
  return (
    <>
      <Text testID="theme-value">{theme}</Text>
      <Pressable testID="toggle-button" onPress={toggleTheme}>
        <Text>toggle</Text>
      </Pressable>
    </>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUseColorScheme.mockReset();
});

test("defaults to the system color scheme when no theme was saved", async () => {
  mockUseColorScheme.mockReturnValue("dark");

  render(
    <AppThemeProvider>
      <ThemeConsumer />
    </AppThemeProvider>
  );

  await waitFor(() => expect(screen.getByTestId("theme-value").props.children).toBe("dark"));
});

test("toggleTheme flips the theme and persists it to AsyncStorage", async () => {
  mockUseColorScheme.mockReturnValue("light");

  render(
    <AppThemeProvider>
      <ThemeConsumer />
    </AppThemeProvider>
  );

  await waitFor(() => expect(screen.getByTestId("theme-value").props.children).toBe("light"));

  fireEvent.press(screen.getByTestId("toggle-button"));

  await waitFor(() => expect(screen.getByTestId("theme-value").props.children).toBe("dark"));
  await waitFor(async () => {
    expect(await AsyncStorage.getItem("theme-override")).toBe("dark");
  });
});

test("loads a previously saved theme from AsyncStorage on mount, overriding the system scheme", async () => {
  mockUseColorScheme.mockReturnValue("dark");
  await AsyncStorage.setItem("theme-override", "light");

  render(
    <AppThemeProvider>
      <ThemeConsumer />
    </AppThemeProvider>
  );

  await waitFor(() => expect(screen.getByTestId("theme-value").props.children).toBe("light"));
});
