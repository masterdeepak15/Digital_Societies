/** What every member may know about the society: how to reach the office, and the two rules the guard's phone follows. */
export interface SocietyOffice {
  name: string;
  address: string;
  city: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  offlineSyncEnabled: boolean;
  piiWipeDays: number;
}

export const DEFAULT_OFFICE: SocietyOffice = {
  name: '', address: '', city: '', pincode: '', contactEmail: '', contactPhone: '', offlineSyncEnabled: true, piiWipeDays: 7,
};

/** Whatever came back, made safe: a missing or odd value never turns the guard's offline mode off or the wipe into zero days. */
export function normalizeOffice(raw: Partial<Record<keyof SocietyOffice, unknown>> | null | undefined): SocietyOffice {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const days = typeof raw?.piiWipeDays === 'number' && Number.isFinite(raw.piiWipeDays) && raw.piiWipeDays >= 1 && raw.piiWipeDays <= 30 ? Math.floor(raw.piiWipeDays) : DEFAULT_OFFICE.piiWipeDays;
  return {
    name: str(raw?.name), address: str(raw?.address), city: str(raw?.city), pincode: str(raw?.pincode),
    contactEmail: str(raw?.contactEmail), contactPhone: str(raw?.contactPhone),
    offlineSyncEnabled: typeof raw?.offlineSyncEnabled === 'boolean' ? raw.offlineSyncEnabled : DEFAULT_OFFICE.offlineSyncEnabled,
    piiWipeDays: days,
  };
}

/** "Near Parandwal Chowk, Dehugaon, Pune 412109" */
export function officeAddress(o: SocietyOffice): string {
  const town = [o.city, o.pincode].filter(Boolean).join(' ');
  return [o.address, town].filter(Boolean).join(', ');
}

/** Digits and a leading plus only, for a phone link. */
export const dialable = (phone: string): string => phone.replace(/[^\d+]/g, '');

/** The guard may add a visitor now: online always, offline only when the society allows it. */
export const mayAddVisitor = (online: boolean, o: Pick<SocietyOffice, 'offlineSyncEnabled'>): boolean => online || o.offlineSyncEnabled;

