import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, getShadow, lightColors, type ThemeColors } from './tokens';
import { useSettingsStore } from '@/store/settingsStore';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  shadow: ReturnType<typeof getShadow>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: darkColors,
  shadow: getShadow('dark'),
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const preference = useSettingsStore((state) => state.settings.themePreference);
  const mode: ThemeMode = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const isDark = mode === 'dark';
  const value = useMemo(
    () => ({
      mode,
      colors: isDark ? darkColors : lightColors,
      shadow: getShadow(mode),
      isDark,
    }),
    [isDark, mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
