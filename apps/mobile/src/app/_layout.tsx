import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { DocumentosProvider } from '@/context/documentos-context';
import { PontoProvider } from '@/context/ponto-context';

// TODO: replace with a real session check (expo-secure-store) once the
// auth/SSO integration lands — for now this just makes the login screen
// reachable by opening the app.
export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PontoProvider>
        <DocumentosProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DocumentosProvider>
      </PontoProvider>
    </ThemeProvider>
  );
}
