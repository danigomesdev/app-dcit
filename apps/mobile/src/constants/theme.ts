/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: '#1B2A6B',
    secondary: '#2F5CFF',
    accent: '#F2531D',
    onAccent: '#ffffff',
    success: '#1D8A6C',
    backgroundScrim: 'rgba(255, 255, 255, 0.9)',
  },
  dark: {
    text: '#ffffff',
    background: '#101B3D',
    backgroundElement: '#1B2A56',
    backgroundSelected: '#26386E',
    textSecondary: '#A9B3D6',
    primary: '#5C72D6',
    secondary: '#5C85FF',
    accent: '#F2531D',
    onAccent: '#ffffff',
    success: '#26A085',
    backgroundScrim: 'rgba(16, 27, 61, 0.82)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  md: 14,
  lg: 20,
  xl: 24,
} as const;

// A single soft-shadow spec reused by every card in the app — iOS reads
// shadow*, Android reads elevation; both are set so the same style object
// works on either platform without a Platform.select at each call site.
export const Elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
