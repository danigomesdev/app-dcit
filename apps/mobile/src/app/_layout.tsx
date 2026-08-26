import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { PontoProvider } from '@/context/ponto-context';

// Keeps login as the base of the stack for a cold, unauthenticated start;
// login itself checks for a saved session on focus and redirects to
// (tabs) when one exists (see login.tsx's useFocusEffect).
export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PontoProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PontoProvider>
    </ThemeProvider>
  );
}
