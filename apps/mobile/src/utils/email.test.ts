import { normalizeEmail, isValidEmail } from './email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  A@X.io ')).toBe('a@x.io');
  });

  it('keeps plus tags', () => {
    expect(normalizeEmail('A+Tag@X.io')).toBe('a+tag@x.io');
  });
});

describe('isValidEmail', () => {
  it.each(['a@b', '', '   ', 'no-at', 'a b@c.io', '@x.io', 'a@.io'])('rejects %p', (v) => {
    expect(isValidEmail(v)).toBe(false);
  });

  it('rejects over 250 chars', () => {
    expect(isValidEmail('a'.repeat(246) + '@x.io')).toBe(false);
  });

  it('accepts a plus-tagged address with surrounding spaces and capitals', () => {
    expect(isValidEmail(' A+b@X.io ')).toBe(true);
  });

  it('accepts exactly 250 chars', () => {
    expect(isValidEmail('a'.repeat(245) + '@x.io')).toBe(true);
  });
});
