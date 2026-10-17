import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ThemeMode } from './themes';

const KEY = 'ds_theme_mode';

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}

interface ModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

/** Appearance preference (default System), persisted on the device. */
export const useThemeMode = create<ModeState>((set) => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    saveThemeMode(mode).catch(() => { /* preference just will not persist */ });
  },
  hydrate: async () => set({ mode: await loadThemeMode() }),
}));
