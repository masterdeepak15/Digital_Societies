'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyMode, readStoredMode, type ThemeMode } from '@/lib/theme'

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light',  label: 'Light',  icon: Sun },
  { mode: 'dark',   label: 'Dark',   icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
]

/** Light / Dark / System radio group. Stored per browser; System follows the OS live. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    const stored = readStoredMode()
    setMode(stored)
    applyMode(stored) // also installs the live OS listener when in system mode
  }, [])

  function choose(next: ThemeMode) {
    setMode(next)
    applyMode(next)
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="flex rounded-lg border border-white/15 p-0.5">
      {options.map(({ mode: m, label, icon: Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => choose(m)}
          className={cn(
            'flex min-h-[32px] flex-1 items-center justify-center rounded-md text-nav-text transition hover:text-white',
            mode === m && 'bg-nav-hi text-white',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
