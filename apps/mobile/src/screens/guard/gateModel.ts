/** Pure rules for the gate-entry form (kept out of the screen so they can be tested). */

export interface Companion { name: string; phone?: string }

export interface EntryForm {
  name: string;
  phone: string;
  flat: string;
  purpose: string;
  vehicleNumber: string;
  vehicleType: string;
  idType: string;
  idLast4: string;
  companions: Companion[];
}

export type Validation = { ok: true; flat: string } | { ok: false; field: 'name' | 'phone' | 'flat' | 'purpose' | 'id' | 'people'; message: string };

export const digitsOnly = (s: string): string => s.replace(/\D/g, '');

const squash = (s: string): string => s.toUpperCase().replace(/[\s-]/g, '');

/** The listed flat the guard meant, or null. "a 204", "A204" and "a-204" all find "A-204". */
export function matchFlat(flats: string[], input: string): string | null {
  const key = squash(input);
  if (!key) return null;
  return flats.find((f) => squash(f) === key) ?? null;
}

/** Flats to suggest while typing: label starts with the query first, then contains it. */
export function filterFlats(flats: string[], query: string, limit = 8): string[] {
  const key = squash(query);
  if (!key) return flats.slice(0, limit);
  const starts = flats.filter((f) => squash(f).startsWith(key));
  const contains = flats.filter((f) => !squash(f).startsWith(key) && squash(f).includes(key));
  return [...starts, ...contains].slice(0, limit);
}

export function validateEntry(f: EntryForm, flats: string[]): Validation {
  if (!f.name.trim()) return { ok: false, field: 'name', message: 'Enter the visitor’s name.' };
  const flat = matchFlat(flats, f.flat);
  if (!flat) return { ok: false, field: 'flat', message: 'Choose the flat from the list.' };
  if (!f.purpose) return { ok: false, field: 'purpose', message: 'Choose why they are visiting.' };
  if (f.phone.trim() && !/^[6-9]\d{9}$/.test(digitsOnly(f.phone).slice(-10))) {
    return { ok: false, field: 'phone', message: 'Enter a 10-digit mobile number, or leave it empty.' };
  }
  const hasType = !!f.idType;
  const hasNumber = !!f.idLast4.trim();
  if (hasType !== hasNumber || (hasNumber && f.idLast4.trim().length !== 4)) {
    return { ok: false, field: 'id', message: 'For an ID, choose its type and enter its last 4 characters.' };
  }
  if (f.companions.length > 10 || f.companions.some((c) => !c.name.trim())) {
    return { ok: false, field: 'people', message: 'Give every extra person a name (up to 10 people).' };
  }
  return { ok: true, flat };
}
