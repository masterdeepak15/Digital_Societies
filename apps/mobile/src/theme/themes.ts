/**
 * Role-based themes, each in a light and a dark variant.
 *   ledger    — admin / accountant / staff and all signed-out screens (dense, navy + saffron)
 *   courtyard — residents (friendly, pine green + sunflower)
 *   control   — guards (high-contrast, teal + amber)
 * The contrast test (themes.test.ts) is the arbiter of every foreground/background pair.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';
export type ThemeName = 'ledger' | 'courtyard' | 'control';

export interface ThemeColors {
  ground: string; surface: string; surfaceAlt: string;
  primary: string; onPrimary: string;
  accent: string; onAccent: string;
  line: string; text: string; muted: string;
  success: string; warning: string; danger: string;
}

export interface ThemeFonts { regular: string; medium: string; semibold: string; bold: string; extrabold: string }

export interface Theme {
  name: ThemeName;
  scheme: Scheme;
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: { control: number; card: number; pill: number };
}

/** system -> the OS scheme when it is known, else light. */
export function resolveScheme(mode: ThemeMode, system: Scheme | null | undefined): Scheme {
  if (mode === 'system') return system ?? 'light';
  return mode;
}

const jakarta: ThemeFonts = {
  regular: 'PlusJakartaSans_400Regular', medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold', bold: 'PlusJakartaSans_700Bold', extrabold: 'PlusJakartaSans_800ExtraBold',
};
const figtree: ThemeFonts = {
  regular: 'Figtree_400Regular', medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold', bold: 'Figtree_700Bold', extrabold: 'Figtree_800ExtraBold',
};
const manrope: ThemeFonts = {
  regular: 'Manrope_400Regular', medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', extrabold: 'Manrope_800ExtraBold',
};

const statusLight = { success: '#1E7F4F', warning: '#8A5200', danger: '#B3261E' };
const statusDark  = { success: '#4ADE80', warning: '#F5B35A', danger: '#FF8A80' };

export const themes: Record<ThemeName, Record<Scheme, Theme>> = {
  ledger: {
    light: {
      name: 'ledger', scheme: 'light', fonts: jakarta, radius: { control: 8, card: 10, pill: 999 },
      colors: {
        ground: '#F4F6F9', surface: '#FFFFFF', surfaceAlt: '#E8ECF2',
        primary: '#12203B', onPrimary: '#FFFFFF', accent: '#E58F1A', onAccent: '#12203B',
        line: '#DCE2EA', text: '#12203B', muted: '#5B6B82', ...statusLight,
      },
    },
    dark: {
      name: 'ledger', scheme: 'dark', fonts: jakarta, radius: { control: 8, card: 10, pill: 999 },
      colors: {
        ground: '#0E1626', surface: '#16213A', surfaceAlt: '#1C2A47',
        primary: '#E58F1A', onPrimary: '#12203B', accent: '#E58F1A', onAccent: '#12203B',
        line: '#2A3A5C', text: '#E6ECF7', muted: '#A3B1C8', ...statusDark,
      },
    },
  },
  courtyard: {
    light: {
      name: 'courtyard', scheme: 'light', fonts: figtree, radius: { control: 16, card: 24, pill: 999 },
      colors: {
        ground: '#F2F7F4', surface: '#FFFFFF', surfaceAlt: '#EEF4F1',
        primary: '#0E5A4C', onPrimary: '#FFFFFF', accent: '#F5B82E', onAccent: '#0B2B26',
        line: '#DCE8E1', text: '#0B2B26', muted: '#41635B', ...statusLight,
      },
    },
    dark: {
      name: 'courtyard', scheme: 'dark', fonts: figtree, radius: { control: 16, card: 24, pill: 999 },
      colors: {
        ground: '#0B1A17', surface: '#12261F', surfaceAlt: '#183229',
        primary: '#5CCFB4', onPrimary: '#062A22', accent: '#F5B82E', onAccent: '#0B2B26',
        line: '#23443A', text: '#E4F2EC', muted: '#9DBDB2', ...statusDark,
      },
    },
  },
  control: {
    light: {
      name: 'control', scheme: 'light', fonts: manrope, radius: { control: 14, card: 16, pill: 999 },
      colors: {
        ground: '#F2F5FA', surface: '#FFFFFF', surfaceAlt: '#E8EDF5',
        primary: '#0C7C74', onPrimary: '#FFFFFF', accent: '#E58F1A', onAccent: '#12203B',
        line: '#D5DCE8', text: '#0E1624', muted: '#4A5B78', ...statusLight,
      },
    },
    dark: {
      name: 'control', scheme: 'dark', fonts: manrope, radius: { control: 14, card: 16, pill: 999 },
      colors: {
        ground: '#0E1624', surface: '#16213A', surfaceAlt: '#1C2A47',
        primary: '#35D0C5', onPrimary: '#0A101C', accent: '#FFB020', onAccent: '#0A101C',
        line: '#2A3A5C', text: '#E6ECF7', muted: '#93A3C0',
        success: '#4ADE80', warning: '#FFB020', danger: '#FF6B5E',
      },
    },
  },
};

export interface Tint { bg: string; fg: string }
export const courtyardTints: Record<Scheme, { mint: Tint; sky: Tint; peach: Tint; lilac: Tint }> = {
  light: {
    mint:  { bg: '#DCEFE5', fg: '#0E5A4C' },
    sky:   { bg: '#DCEBFA', fg: '#0B3A66' },
    peach: { bg: '#FDE6D3', fg: '#5E2C08' },
    lilac: { bg: '#E8E3FA', fg: '#2C1E66' },
  },
  dark: {
    mint:  { bg: '#17382F', fg: '#BFE9DA' },
    sky:   { bg: '#142A44', fg: '#BBD8F5' },
    peach: { bg: '#40281A', fg: '#F7D2B5' },
    lilac: { bg: '#2A2347', fg: '#D5CDF5' },
  },
};

/**
 * guard -> control; admin / accountant / staff / signed out -> ledger;
 * everyone else (resident, tenant, family, unknown) -> courtyard, like RoleRouter's default.
 */
export function themeForRole(role: string | null, scheme: Scheme): Theme {
  switch (role) {
    case 'guard':
      return themes.control[scheme];
    case 'admin':
    case 'accountant':
    case 'staff':
    case null:
      return themes.ledger[scheme];
    default:
      return themes.courtyard[scheme];
  }
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two #rrggbb colors. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
