import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useThemeMode } from './modeStore';
import { resolveScheme, themeForRole, themes, type Theme } from './themes';

const ThemeContext = createContext<Theme>(themes.ledger.light);

/** Picks the role theme in the resolved light/dark scheme and keeps the status bar in sync. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.activeRole);
  const mode = useThemeMode((s) => s.mode);
  const system = useColorScheme();

  useEffect(() => { useThemeMode.getState().hydrate(); }, []);

  const theme = useMemo(
    () => themeForRole(role, resolveScheme(mode, system === 'dark' || system === 'light' ? system : null)),
    [role, mode, system],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): Theme => useContext(ThemeContext);
