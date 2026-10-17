import {
  themes, themeForRole, resolveScheme, contrastRatio, courtyardTints,
  type Scheme, type Theme,
} from './themes';

const SCHEMES: Scheme[] = ['light', 'dark'];
const NAMES = ['ledger', 'courtyard', 'control'] as const;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe('resolveScheme', () => {
  it.each([
    ['light', 'dark',    'light'],
    ['dark',  'light',   'dark'],
    ['system', 'dark',   'dark'],
    ['system', 'light',  'light'],
    ['system', null,     'light'],
    ['system', undefined, 'light'],
  ] as const)('mode %p with system %p -> %p', (mode, system, expected) => {
    expect(resolveScheme(mode, system)).toBe(expected);
  });
});

describe('themeForRole', () => {
  it.each(SCHEMES)('maps roles to themes in %s', (scheme) => {
    expect(themeForRole('guard', scheme).name).toBe('control');
    for (const r of ['admin', 'accountant', 'staff', null]) expect(themeForRole(r, scheme).name).toBe('ledger');
    for (const r of ['resident', 'tenant', 'family', 'zzz']) expect(themeForRole(r, scheme).name).toBe('courtyard');
    expect(themeForRole('guard', scheme).scheme).toBe(scheme);
  });
});

describe('WCAG AA contrast in every theme variant', () => {
  const variants: [string, Theme][] = [];
  for (const n of NAMES) for (const s of SCHEMES) variants.push([`${n}/${s}`, themes[n][s]]);

  it.each(variants)('%s text pairs reach 4.5:1', (_label, t) => {
    const c = t.colors;
    const pairs: [string, string, string][] = [
      ['text on ground', c.text, c.ground],
      ['text on surface', c.text, c.surface],
      ['muted on ground', c.muted, c.ground],
      ['muted on surface', c.muted, c.surface],
      ['onPrimary on primary', c.onPrimary, c.primary],
      ['onAccent on accent', c.onAccent, c.accent],
      ['danger on surface', c.danger, c.surface],
      ['warning on surface', c.warning, c.surface],
      ['success on surface', c.success, c.surface],
      ['danger on ground', c.danger, c.ground],
      ['warning on ground', c.warning, c.ground],
      ['success on ground', c.success, c.ground],
    ];
    const failing = pairs
      .map(([label, fg, bg]) => ({ label, fg, bg, ratio: contrastRatio(fg, bg) }))
      .filter((p) => p.ratio < 4.5);
    expect(failing).toEqual([]);
  });

  it.each(variants)('%s primary reads against the ground at 3:1 (UI component)', (_l, t) => {
    expect(contrastRatio(t.colors.primary, t.colors.ground)).toBeGreaterThanOrEqual(3);
  });

  it.each(SCHEMES)('courtyard tints in %s reach 4.5:1', (scheme) => {
    for (const [name, tint] of Object.entries(courtyardTints[scheme])) {
      expect({ name, ratio: contrastRatio(tint.fg, tint.bg) >= 4.5 }).toEqual({ name, ratio: true });
    }
  });

  it('every theme declares the five font weights', () => {
    for (const [, t] of variants) {
      expect(Object.keys(t.fonts).sort()).toEqual(['bold', 'extrabold', 'medium', 'regular', 'semibold']);
    }
  });
});
