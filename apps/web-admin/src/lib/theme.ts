export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_KEY = 'ds_theme'

/** light/dark are explicit; system follows the OS. */
export function resolveDark(mode: ThemeMode, prefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && prefersDark)
}

/** The stored mode, or system when nothing valid is stored (or storage is unavailable). */
export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

let query: MediaQueryList | null = null
let onChange: (() => void) | null = null

function paint(mode: ThemeMode, prefersDark: boolean) {
  const dark = resolveDark(mode, prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

/** Stores the mode, updates the <html> class, and while in "system" mode follows the OS live. */
export function applyMode(mode: ThemeMode): void {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* the preference just will not persist */ }

  query = query ?? window.matchMedia('(prefers-color-scheme: dark)')
  if (onChange) query.removeEventListener('change', onChange)
  onChange = null

  paint(mode, query.matches)
  if (mode === 'system') {
    onChange = () => paint('system', query!.matches)
    query.addEventListener('change', onChange)
  }
}

/** Runs inline in <head> before first paint so a reload never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_KEY}');if(m!=='light'&&m!=='dark')m='system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;if(d)e.classList.add('dark');e.style.colorScheme=d?'dark':'light'}catch(x){}})();`
