import { DEFAULT_OFFICE, dialable, mayAddVisitor, normalizeOffice, officeAddress } from './societyOfficeModel';

describe('normalizeOffice', () => {
  it('keeps what the server sent', () => {
    expect(normalizeOffice({ name: 'Govindbaug', address: 'Dehugaon', city: 'Pune', pincode: '412109', contactEmail: 'o@g.in', contactPhone: '+919975001173', offlineSyncEnabled: false, piiWipeDays: 14 }))
      .toEqual({ name: 'Govindbaug', address: 'Dehugaon', city: 'Pune', pincode: '412109', contactEmail: 'o@g.in', contactPhone: '+919975001173', offlineSyncEnabled: false, piiWipeDays: 14 });
  });
  it('falls back safely for anything missing or odd', () => {
    expect(normalizeOffice(null)).toEqual(DEFAULT_OFFICE);
    expect(normalizeOffice({ offlineSyncEnabled: 'no' as unknown as boolean, piiWipeDays: 0 })).toMatchObject({ offlineSyncEnabled: true, piiWipeDays: 7 });
    expect(normalizeOffice({ piiWipeDays: 99 }).piiWipeDays).toBe(7);
    expect(normalizeOffice({ piiWipeDays: 10.7 }).piiWipeDays).toBe(10);
  });
});

describe('office details', () => {
  it('writes the address for people', () => {
    expect(officeAddress({ ...DEFAULT_OFFICE, address: 'Near Parandwal Chowk', city: 'Pune', pincode: '412109' })).toBe('Near Parandwal Chowk, Pune 412109');
    expect(officeAddress({ ...DEFAULT_OFFICE, address: 'Dehugaon' })).toBe('Dehugaon');
    expect(officeAddress(DEFAULT_OFFICE)).toBe('');
  });
  it('makes a number dialable', () => expect(dialable('+91 99750-01173')).toBe('+919975001173'));
});

describe('mayAddVisitor', () => {
  it('lets the guard work online always, and offline only when the society allows it', () => {
    expect(mayAddVisitor(true, { offlineSyncEnabled: false })).toBe(true);
    expect(mayAddVisitor(false, { offlineSyncEnabled: true })).toBe(true);
    expect(mayAddVisitor(false, { offlineSyncEnabled: false })).toBe(false);
  });
});
