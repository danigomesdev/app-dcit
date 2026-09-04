/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useOptionalThemeContext } from '@/context/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const override = useOptionalThemeContext();
  const scheme = useColorScheme();
  const systemTheme = scheme === 'unspecified' ? 'light' : scheme;

  return Colors[override?.theme ?? systemTheme];
}
