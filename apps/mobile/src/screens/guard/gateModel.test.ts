import { filterFlats, matchFlat, validateEntry, digitsOnly, type EntryForm } from './gateModel';

const FLATS = ['A-101', 'A-102', 'A-204', 'B-101', 'B-204'];

describe('matchFlat', () => {
  it('accepts an exact label ignoring case, spaces and the dash', () => {
    expect(matchFlat(FLATS, 'a-204')).toBe('A-204');
    expect(matchFlat(FLATS, 'A 204')).toBe('A-204');
    expect(matchFlat(FLATS, 'b204')).toBe('B-204');
  });
  it('rejects a flat that is not in the list', () => {
    expect(matchFlat(FLATS, 'C-999')).toBeNull();
    expect(matchFlat(FLATS, '')).toBeNull();
  });
});

describe('filterFlats', () => {
  it('lists everything for an empty query, capped', () => {
    expect(filterFlats(FLATS, '', 3)).toEqual(['A-101', 'A-102', 'A-204']);
  });
  it('matches anywhere in the label, prefix matches first', () => {
    expect(filterFlats(FLATS, '204')).toEqual(['A-204', 'B-204']);
    expect(filterFlats(FLATS, 'b')).toEqual(['B-101', 'B-204']);
    expect(filterFlats(FLATS, '1')).toEqual(['A-101', 'A-102', 'B-101']);
  });
  it('returns nothing when nothing matches', () => {
    expect(filterFlats(FLATS, 'zzz')).toEqual([]);
  });
});

describe('digitsOnly', () => {
  it('keeps just the digits', () => expect(digitsOnly('+91 98765-43210')).toBe('919876543210'));
});

const base: EntryForm = {
  name: 'Ravi Kumar', phone: '', flat: 'A-101', purpose: 'Guest',
  vehicleNumber: '', vehicleType: '', idType: '', idLast4: '', companions: [],
};

describe('validateEntry', () => {
  it('accepts the minimum: name, a known flat and a purpose', () => {
    expect(validateEntry(base, FLATS)).toEqual({ ok: true, flat: 'A-101' });
  });
  it('requires a flat from the list', () => {
    expect(validateEntry({ ...base, flat: 'Z-1' }, FLATS)).toMatchObject({ ok: false, field: 'flat' });
    expect(validateEntry({ ...base, flat: '' }, FLATS)).toMatchObject({ ok: false, field: 'flat' });
  });
  it('requires a name and a purpose', () => {
    expect(validateEntry({ ...base, name: '  ' }, FLATS)).toMatchObject({ ok: false, field: 'name' });
    expect(validateEntry({ ...base, purpose: '' }, FLATS)).toMatchObject({ ok: false, field: 'purpose' });
  });
  it('only checks the phone when one is given: 10 digits, starting 6-9', () => {
    expect(validateEntry({ ...base, phone: '98765 43210' }, FLATS).ok).toBe(true);
    expect(validateEntry({ ...base, phone: '12345' }, FLATS)).toMatchObject({ ok: false, field: 'phone' });
    expect(validateEntry({ ...base, phone: '1234567890' }, FLATS)).toMatchObject({ ok: false, field: 'phone' });
  });
  it('treats the ID as optional but wants a type and the last 4 characters together', () => {
    expect(validateEntry({ ...base, idType: 'aadhaar', idLast4: '9012' }, FLATS).ok).toBe(true);
    expect(validateEntry({ ...base, idType: 'aadhaar', idLast4: '90' }, FLATS)).toMatchObject({ ok: false, field: 'id' });
    expect(validateEntry({ ...base, idType: '', idLast4: '9012' }, FLATS)).toMatchObject({ ok: false, field: 'id' });
  });
  it('wants a name for every extra person and at most 10', () => {
    expect(validateEntry({ ...base, companions: [{ name: 'Sita' }] }, FLATS).ok).toBe(true);
    expect(validateEntry({ ...base, companions: [{ name: '' }] }, FLATS)).toMatchObject({ ok: false, field: 'people' });
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `P${i}` }));
    expect(validateEntry({ ...base, companions: eleven }, FLATS)).toMatchObject({ ok: false, field: 'people' });
  });
});
