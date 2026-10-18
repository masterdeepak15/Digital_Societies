import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../utils/api';

const KEY = 'ds_flat_labels';

/** "A-2" before "A-10": compare the letters, then the number. */
export const compareFlats = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** The society's flats ("A-101", …). Remembered on the phone, so the guard can still pick a flat offline. */
export async function loadFlats(): Promise<string[]> {
  try {
    const map = await apiFetch<Record<string, string>>('/billing/flat-labels');
    const list = Object.values(map).filter(Boolean).sort(compareFlats);
    await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
    return list;
  } catch (e) {
    const cached = await AsyncStorage.getItem(KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as string[];
    throw e;
  }
}
