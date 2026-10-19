import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../utils/api';
import { normalizeOffice, type SocietyOffice } from './societyOfficeModel';

export * from './societyOfficeModel';

const KEY = 'ds_society_office';

/** The last answer is kept on the phone, so the rules still apply when the guard has no signal. */
export async function fetchOffice(): Promise<SocietyOffice> {
  try {
    const office = normalizeOffice(await apiFetch<Record<string, unknown>>('/settings/public'));
    AsyncStorage.setItem(KEY, JSON.stringify(office)).catch(() => {});
    return office;
  } catch (e) {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved) return normalizeOffice(JSON.parse(saved));
    } catch { /* fall through */ }
    throw e;
  }
}
