import { Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../use-theme";
import { AppThemeProvider } from "@/context/theme-context";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(),
}));

import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

function BackgroundProbe() {
  const theme = useTheme();
  return <Text testID="background">{theme.background}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUseColorScheme.mockReset();
});

test("returns colors for the system color scheme when rendered without an AppThemeProvider", () => {
  mockUseColorScheme.mockReturnValue("dark");

  render(<BackgroundProbe />);

  expect(screen.getByTestId("background").props.children).toBe("#101B3D");
});

test("returns colors for the saved override when wrapped in an AppThemeProvider", async () => {
  mockUseColorScheme.mockReturnValue("dark");
  await AsyncStorage.setItem("theme-override", "light");

  render(
    <AppThemeProvider>
      <BackgroundProbe />
    </AppThemeProvider>
  );

  await waitFor(() => expect(screen.getByTestId("background").props.children).toBe("#ffffff"));
});
