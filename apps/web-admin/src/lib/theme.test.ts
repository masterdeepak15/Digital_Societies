import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveDark, readStoredMode, THEME_KEY, THEME_INIT_SCRIPT } from './theme'

function stubStorage(initial: Record<string, string> = {}) {
  const mem = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v) },
    removeItem: (k: string) => { mem.delete(k) },
  })
  return mem
}

describe('resolveDark', () => {
  it.each([
    ['light', true,  false],
    ['light', false, false],
    ['dark',  true,  true],
    ['dark',  false, true],
    ['system', true,  true],
    ['system', false, false],
  ] as const)('mode %s with prefersDark=%s -> %s', (mode, prefers, expected) => {
    expect(resolveDark(mode, prefers)).toBe(expected)
  })
})

describe('readStoredMode', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('defaults to system when nothing is stored', () => {
    stubStorage()
    expect(readStoredMode()).toBe('system')
  })

  it.each(['light', 'dark', 'system'] as const)('returns a stored %s', (mode) => {
    stubStorage({ [THEME_KEY]: mode })
    expect(readStoredMode()).toBe(mode)
  })

  it('ignores an invalid stored value', () => {
    stubStorage({ [THEME_KEY]: 'blue' })
    expect(readStoredMode()).toBe('system')
  })

  it('falls back to system when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readStoredMode()).toBe('system')
  })
})

describe('THEME_INIT_SCRIPT', () => {
  it('reads the same storage key the app writes', () => {
    expect(THEME_INIT_SCRIPT).toContain(`'${THEME_KEY}'`)
  })

  function run(stored: string | null, prefersDark: boolean) {
    const classes = new Set<string>()
    const root = { classList: { add: (c: string) => classes.add(c) }, style: {} as Record<string, string> }
    new Function('localStorage', 'window', 'document', THEME_INIT_SCRIPT)(
      { getItem: () => stored },
      { matchMedia: () => ({ matches: prefersDark }) },
      { documentElement: root },
    )
    return { dark: classes.has('dark'), scheme: root.style.colorScheme }
  }

  it('adds the dark class before paint for stored dark', () => {
    expect(run('dark', false)).toEqual({ dark: true, scheme: 'dark' })
  })
  it('keeps light for stored light even when the OS prefers dark', () => {
    expect(run('light', true)).toEqual({ dark: false, scheme: 'light' })
  })
  it('follows the OS for system or missing values', () => {
    expect(run(null, true).dark).toBe(true)
    expect(run('system', false).dark).toBe(false)
    expect(run('garbage', true).dark).toBe(true)
  })
})
