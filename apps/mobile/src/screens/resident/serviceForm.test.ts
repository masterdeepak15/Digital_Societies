import { EMPTY_SERVICE_FORM, approvalNote, canBook, serviceFormError, toServicePayload } from './serviceForm';

const ok = { ...EMPTY_SERVICE_FORM, providerName: 'Ramesh Kale', phone: '99750 01173', title: 'Leak repair', rate: '350' };

describe('serviceFormError', () => {
  it('accepts a complete form', () => expect(serviceFormError(ok)).toBeNull());
  it('asks for each missing part in plain words', () => {
    expect(serviceFormError({ ...ok, providerName: ' ' })).toMatch(/name/i);
    expect(serviceFormError({ ...ok, phone: '12345' })).toMatch(/phone/i);
    expect(serviceFormError({ ...ok, title: 'ab' })).toMatch(/service/i);
    expect(serviceFormError({ ...ok, rate: '' })).toMatch(/rate/i);
    expect(serviceFormError({ ...ok, rate: '0' })).toMatch(/rate/i);
    expect(serviceFormError({ ...ok, rate: 'abc' })).toMatch(/rate/i);
  });
});

describe('toServicePayload', () => {
  it('cleans the phone number and sends the rate as a number', () => {
    expect(toServicePayload(ok)).toMatchObject({ providerName: 'Ramesh Kale', phone: '9975001173', baseRateRupees: 350, rateUnit: 'PerVisit', category: 'Plumber' });
  });
});

describe('approval', () => {
  it('tells the owner where the registration stands', () => {
    expect(approvalNote('Pending')).toMatch(/waiting/i);
    expect(approvalNote('Rejected', 'Phone is wrong')).toMatch(/Phone is wrong/);
    expect(approvalNote('Approved')).toBeNull();
    expect(approvalNote(undefined)).toBeNull();
  });
  it('lets residents book only approved services', () => {
    expect(canBook({ approval: 'Approved' })).toBe(true);
    expect(canBook({})).toBe(true);
    expect(canBook({ approval: 'Pending' })).toBe(false);
    expect(canBook({ approval: 'Rejected' })).toBe(false);
  });
});
