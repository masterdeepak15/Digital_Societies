'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2, LayoutDashboard, CreditCard, Users, MessageSquare, ShieldAlert, Megaphone, BarChart3,
  CalendarCheck, Car, Globe, ShoppingBag, Wallet, Settings, LogOut, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsOf } from '@/lib/utils'
import { getUser, logout as authLogout, type AdminUser } from '@/lib/auth'
import { stopSignalR } from '@/lib/useSignalR'
import { ThemeToggle } from './ThemeToggle'

interface NavItem { label: string; href: string; icon: LucideIcon }
interface NavGroup { label?: string; items: NavItem[] }

const groups: NavGroup[] = [
  { items: [{ label: 'Overview', href: '/dashboard', icon: LayoutDashboard }] },
  { label: 'Money', items: [
    { label: 'Billing',    href: '/billing',    icon: CreditCard },
    { label: 'Accounting', href: '/accounting', icon: BarChart3 },
    { label: 'Wallet',     href: '/wallet',     icon: Wallet },
  ] },
  { label: 'People', items: [
    { label: 'Members',  href: '/members',  icon: Users },
    { label: 'Visitors', href: '/visitors', icon: ShieldAlert },
  ] },
  { label: 'Operations', items: [
    { label: 'Complaints',  href: '/complaints',  icon: MessageSquare },
    { label: 'Notices',     href: '/notices',     icon: Megaphone },
    { label: 'Facilities',  href: '/facilities',  icon: CalendarCheck },
    { label: 'Parking',     href: '/parking',     icon: Car },
    { label: 'Social feed', href: '/social',      icon: Globe },
    { label: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
    { label: 'Settings',    href: '/settings',    icon: Settings },
  ] },
]

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)

  useEffect(() => { setUser(getUser()) }, [])

  async function logout() {
    await stopSignalR()  // close WebSocket cleanly before clearing session
    await authLogout()   // POST /auth/logout + clears cookies/localStorage
    router.push('/login')
  }

  return (
    <aside
      id="sidebar"
      aria-label="Sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col bg-nav px-3 py-5 text-nav-text transition-transform',
        open ? 'translate-x-0' : '-translate-x-full invisible lg:visible lg:translate-x-0',
      )}
    >
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="rounded-lg bg-saffron p-2">
          <Building2 className="h-[18px] w-[18px] text-[#12203B]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Digital Societies</p>
          <p className="text-xs text-nav-text">Admin console</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((g, i) => (
          <div key={g.label ?? i} className="space-y-0.5">
            {g.label && <p className="px-3 pb-1 text-xs text-nav-text/80">{g.label}</p>}
            {g.items.map(({ label, href, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-nav-hi text-white shadow-[inset_3px_0_0_rgb(var(--saffron))]'
                      : 'hover:bg-nav-hi/60 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nav-hi text-xs font-bold text-white" aria-hidden="true">
            {user ? initialsOf(user.name) : ''}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.name ?? 'Signed in'}</p>
            <p className="truncate text-xs capitalize text-nav-text">{user?.roles?.[0] ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-nav-text transition hover:bg-nav-hi hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
