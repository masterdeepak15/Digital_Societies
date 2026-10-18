const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockMem.get(k) ?? null,
    setItem: async (k: string, v: string) => { mockMem.set(k, v); },
    removeItem: async (k: string) => { mockMem.delete(k); },
  },
}));

import { loadThemeMode, saveThemeMode } from './modeStore';

beforeEach(() => mockMem.clear());

describe('theme mode persistence', () => {
  it('defaults to system when nothing is stored', async () => {
    expect(await loadThemeMode()).toBe('system');
  });

  it('round-trips light, dark and system', async () => {
    for (const m of ['light', 'dark', 'system'] as const) {
      await saveThemeMode(m);
      expect(await loadThemeMode()).toBe(m);
    }
  });

  it('ignores an invalid stored value', async () => {
    mockMem.set('ds_theme_mode', 'blue');
    expect(await loadThemeMode()).toBe('system');
  });
});
