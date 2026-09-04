import { fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeToggle } from "../theme-toggle";
import { AppThemeProvider } from "@/context/theme-context";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(),
}));

import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUseColorScheme.mockReturnValue("light");
});

test("shows a single theme icon", () => {
  render(
    <AppThemeProvider>
      <ThemeToggle />
    </AppThemeProvider>
  );

  expect(screen.getByLabelText("Alterar tema")).toBeTruthy();
});

test("pressing the icon toggles the theme and persists it", async () => {
  render(
    <AppThemeProvider>
      <ThemeToggle />
    </AppThemeProvider>
  );

  fireEvent.press(screen.getByLabelText("Alterar tema"));

  expect(await AsyncStorage.getItem("theme-override")).toBe("dark");

  fireEvent.press(screen.getByLabelText("Alterar tema"));

  expect(await AsyncStorage.getItem("theme-override")).toBe("light");
});
