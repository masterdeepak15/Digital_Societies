'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

/**
 * Sidebar on large screens; below 1024 px a top bar with a menu button opens it as an overlay
 * (Escape, the scrim and any nav link close it; focus moves into the menu on open and back to the menu button on close).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => { setOpen(false) }, [pathname])

  // Move focus into the menu when it opens and back to the menu button however it closes
  // (Escape, scrim, nav link), so keyboard users never lose their place.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) {
      document.querySelector<HTMLElement>('#sidebar a')?.focus()
    } else if (wasOpen.current) {
      menuButton.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-screen lg:pl-[236px]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          ref={menuButton}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-sm font-bold text-ink">Digital Societies</span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <Sidebar open={open} onNavigate={() => setOpen(false)} />

      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  )
}
